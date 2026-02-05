// Structure Viewer
// - Folder tree via File System Access API (showDirectoryPicker), lazy loads subfolders.
// - JSON tree via file input.
// - GitHub public repo tree via GitHub API (single recursive tree call).
// - Export PNG via html2canvas (view or full), including advanced icons.

const elTree = document.getElementById("tree");
const elMeta = document.getElementById("meta");

const btnPickFolder = document.getElementById("btnPickFolder");
const jsonInput = document.getElementById("jsonInput");

const btnCollapseAll = document.getElementById("btnCollapseAll");
const btnExpandAll = document.getElementById("btnExpandAll");
const btnExportView = document.getElementById("btnExportView");
const btnExportFull = document.getElementById("btnExportFull");

// GitHub UI (optional)
const btnLoadGitHub = document.getElementById("btnLoadGitHub");
const ghRepo = document.getElementById("ghRepo");
const ghBranch = document.getElementById("ghBranch");

let currentRoot = null; // generic node model
let currentMode = null; // "folder" | "json" | "github"

const PRIORITY_FIELDS = ["name", "username", "title", "id"];

function setControlsEnabled(enabled) {
  btnCollapseAll.disabled = !enabled;
  btnExpandAll.disabled = !enabled;
  btnExportView.disabled = !enabled;
  btnExportFull.disabled = !enabled;
}

function clearTree() {
  elTree.innerHTML = "";
  currentRoot = null;
  currentMode = null;
  setControlsEnabled(false);
  elMeta.textContent = "No data loaded.";
}

function humanNow() {
  const d = new Date();
  return d.toLocaleString();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ------------------------
// Node model + rendering
// ------------------------

/**
 * Generic node:
 * {
 *   id: string,
 *   label: string,
 *   type: "folder"|"file"|"json",
 *   children: Node[],
 *   hasChildren: boolean,
 *   loaded: boolean, // for folders lazy loading (local FS only)
 *   fsHandle?: FileSystemHandle, // local FS
 *   source?: "fs"|"github"|"json" // optional
 * }
 */

let nodeIdCounter = 0;
function makeId() {
  nodeIdCounter += 1;
  return `n_${nodeIdCounter}`;
}

function iconFor(node) {
  if (node.type === "folder") return { kind: "emoji", value: "📁" };
  if (node.type === "json") return { kind: "emoji", value: "🔹" };

  if (node.type === "file") {
    if (!advancedIconsEnabled) return { kind: "emoji", value: "📄" };
    return { kind: "lazy-web-icon", value: node.label }; // file name
  }

  return { kind: "emoji", value: "🔹" };
}

function createNodeElement(node) {
  const container = document.createElement("div");
  container.className = "treeItem";
  container.dataset.nodeId = node.id;

  const row = document.createElement("div");
  row.className = "node";

  const twisty = document.createElement("span");
  twisty.className = "twisty";
  twisty.textContent = node.hasChildren ? "▶" : "•";
  if (!node.hasChildren) twisty.classList.add("hidden");

  const icon = document.createElement("span");
  icon.className = "icon";

  const ico = iconFor(node);

  if (ico.kind === "emoji") {
    icon.textContent = ico.value;
  } else if (ico.kind === "lazy-web-icon") {
    icon.textContent = "";

    const ext = getFileExtension(ico.value);
    icon.dataset.ext = ext || "";
    icon.dataset.iconReady = "0";

    // placeholder image (keeps layout stable)
    const img = document.createElement("img");
    img.alt = "";
    img.width = 16;
    img.height = 16;
    img.decoding = "async";
    img.loading = "lazy";
    img.style.verticalAlign = "middle";
    img.style.display = "inline-block";
    icon.appendChild(img);

    if (!ext) {
      icon.textContent = "📄";
      icon.dataset.iconReady = "1";
    } else {
      getIconDataUrlForExt(ext)
        .then((dataUrl) => {
          if (!dataUrl) {
            icon.textContent = "📄";
            icon.dataset.iconReady = "1";
            return;
          }

          const targetImg = icon.querySelector("img") || img;
          targetImg.onload = () => (icon.dataset.iconReady = "1");
          targetImg.onerror = () => {
            icon.textContent = "📄";
            icon.dataset.iconReady = "1";
          };
          targetImg.src = dataUrl;

          // If already cached, onload might not fire reliably
          if (targetImg.complete && targetImg.naturalWidth > 0) {
            icon.dataset.iconReady = "1";
          }
        })
        .catch(() => {
          icon.textContent = "📄";
          icon.dataset.iconReady = "1";
        });
    }
  }

  const label = document.createElement("span");
  label.className = "label";
  label.textContent = node.label;

  row.appendChild(twisty);
  row.appendChild(icon);
  row.appendChild(label);

  const childrenWrap = document.createElement("div");
  childrenWrap.className = "children";

  container.appendChild(row);
  container.appendChild(childrenWrap);

  // Toggle behavior
  if (node.hasChildren) {
    row.addEventListener("click", async () => {
      // don't toggle if user selects text
      const sel = window.getSelection?.();
      if (sel && sel.toString()) return;

      const isOpen = container.classList.contains("open");
      if (isOpen) {
        container.classList.remove("open");
        twisty.textContent = "▶";
        return;
      }

      // opening:
      container.classList.add("open");
      twisty.textContent = "▼";

      // JSON nodes: always have children ready
      if (node.type === "json") {
        renderChildren(node, childrenWrap);
        return;
      }

      // Folder nodes:
      if (node.type === "folder") {
        // GitHub folders (and any pre-built folder tree) must render immediately
        if (node.loaded) {
          renderChildren(node, childrenWrap);
          return;
        }

        // local FS folders: lazy load
        twisty.textContent = "⏳";
        try {
          await loadFolderChildren(node);
          node.loaded = true;
          renderChildren(node, childrenWrap);
          twisty.textContent = "▼";
        } catch (err) {
          console.error(err);
          twisty.textContent = "!";
          childrenWrap.innerHTML = `<div class="node"><span class="twisty hidden">•</span><span class="icon">⚠️</span><span class="label">Failed to read folder (permissions?)</span></div>`;
        }
      }
    });
  }

  return container;
}

function renderTree(root) {
  elTree.innerHTML = "";
  const rootEl = createNodeElement(root);
  elTree.appendChild(rootEl);

  // auto-open root for nicer UX
  const row = rootEl.querySelector(".node");
  if (row) row.click();
}

function renderChildren(node, childrenWrap) {
  childrenWrap.innerHTML = "";
  const frag = document.createDocumentFragment();
  for (const ch of node.children) {
    frag.appendChild(createNodeElement(ch));
  }
  childrenWrap.appendChild(frag);
}

function findNodeElementById(nodeId) {
  return elTree.querySelector(`[data-node-id="${nodeId}"]`);
}

function setNodeOpenState(nodeEl, open) {
  const twisty = nodeEl.querySelector(":scope > .node > .twisty");
  if (!twisty) return;

  if (open) {
    nodeEl.classList.add("open");
    if (!twisty.classList.contains("hidden")) twisty.textContent = "▼";
  } else {
    nodeEl.classList.remove("open");
    if (!twisty.classList.contains("hidden")) twisty.textContent = "▶";
  }
}

function collectAllNodeElements() {
  return Array.from(elTree.querySelectorAll("[data-node-id]"));
}

// Restore open state properly by ALSO rendering children where needed
async function restoreOpenState(openSet) {
  if (!currentRoot || !openSet || openSet.size === 0) return;

  const queue = [currentRoot];
  while (queue.length) {
    const node = queue.shift();
    const shouldOpen = openSet.has(node.id);
    if (!shouldOpen) continue;

    const el = findNodeElementById(node.id);
    if (!el) continue;

    setNodeOpenState(el, true);

    const childrenWrap = el.querySelector(":scope > .children");
    if (!childrenWrap) continue;

    // Ensure children exist in DOM before trying to open deeper ones
    if (node.type === "json") {
      renderChildren(node, childrenWrap);
    } else if (node.type === "folder") {
      if (node.loaded) {
        renderChildren(node, childrenWrap);
      } else {
        // local FS only
        await loadFolderChildren(node);
        node.loaded = true;
        renderChildren(node, childrenWrap);
      }
    }

    for (const ch of node.children) queue.push(ch);
  }
}

// ------------------------
// Theme switch
// ------------------------

const themeSelect = document.getElementById("themeSelect");
const exportUseThemeBg = document.getElementById("exportUseThemeBg");

function applyTheme(mode) {
  // mode: "system" | "dark" | "light"
  if (mode === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }
  localStorage.setItem("sv_theme", mode);
}

function getEffectiveTheme() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "dark" || explicit === "light") return explicit;
  // system
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function themeVars(theme) {
  if (theme === "light") {
    return {
      bg: "#f6f8fc",
      panel: "#ffffff",
      border: "#d7deea",
      text: "#0e1625",
      muted: "#52627a",
      btn: "#eef2fb",
      btnHover: "#e3e9f7",
    };
  }
  return {
    bg: "#0b0f17",
    panel: "#101827",
    border: "#1d2a44",
    text: "#e6edf7",
    muted: "#9fb0c8",
    btn: "#1b2a46",
    btnHover: "#24365a",
  };
}

function setThemeOnElement(el, theme) {
  el.style.setProperty("--bg", theme.bg);
  el.style.setProperty("--panel", theme.panel);
  el.style.setProperty("--border", theme.border);
  el.style.setProperty("--text", theme.text);
  el.style.setProperty("--muted", theme.muted);
  el.style.setProperty("--btn", theme.btn);
  el.style.setProperty("--btnHover", theme.btnHover);
}

// ------------------------
// Advanced Icons
// ------------------------

const advancedIconsToggle = document.getElementById("advancedIcons");
let advancedIconsEnabled = false;

// Cache: ext -> dataURL
const ICON_CACHE = new Map();

// Optional persistent cache
const ICON_CACHE_LS_KEY = "sv_icon_cache_v1";
const ICON_CACHE_MAX = 200;

// Must be loaded BEFORE app.js in index.html
const EXT_TO_ICONKEY = window.EXT_TO_ICONKEY || {};

// Some vscode-icons keys differ / move. This adds resilience (incl. your .js case).
const KEY_FALLBACKS = {
  javascript: ["js", "nodejs", "node"],
  typescript: ["ts"],
  reactjs: ["react"],
  reactts: ["react"],
  markdown: ["md"],
  csharp: ["cs"],
  yaml: ["yml"],
  shell: ["sh"],
  powershell: ["ps"],
  powerpoint: ["ppt"],
  excel: ["xls"],
  word: ["doc"],
};

// Base URL for vscode-icons
const VSCODE_ICONS_BASE =
  "https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/";

function iconUrlForKey(key) {
  return `${VSCODE_ICONS_BASE}file_type_${key}.svg`;
}

function getFileExtension(name) {
  const base = name.split("/").pop();
  const i = base.lastIndexOf(".");
  if (i <= 0 || i === base.length - 1) return "";
  return base.slice(i + 1).toLowerCase();
}

function safeCacheLoad() {
  try {
    const raw = localStorage.getItem(ICON_CACHE_LS_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    for (const [k, v] of arr) ICON_CACHE.set(k, v);
  } catch {}
}

function safeCacheSave() {
  try {
    const arr = Array.from(ICON_CACHE.entries()).slice(-ICON_CACHE_MAX);
    localStorage.setItem(ICON_CACHE_LS_KEY, JSON.stringify(arr));
  } catch {}
}

// Fetch remote SVG and convert to PNG data URL (export-safe)
async function fetchIconAsPngDataUrl(url, size = 32) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Icon fetch failed: ${res.status}`);
  const svgText = await res.text();

  const normalizedSvg = svgText.includes('xmlns="http://www.w3.org/2000/svg"')
    ? svgText
    : svgText.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

  const svgDataUrl =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(normalizedSvg);

  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";

  return await new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      const iw = img.naturalWidth || size;
      const ih = img.naturalHeight || size;
      const scale = Math.min(size / iw, size / ih);
      const w = iw * scale;
      const h = ih * scale;
      const x = (size - w) / 2;
      const y = (size - h) / 2;

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, x, y, w, h);

      try {
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = svgDataUrl;
  });
}

async function getIconDataUrlForExt(ext) {
  if (!ext) return null;

  // Cache by extension
  if (ICON_CACHE.has(ext)) return ICON_CACHE.get(ext);

  const primaryKey = EXT_TO_ICONKEY[ext];
  if (!primaryKey) return null;

  // Try primary key + fallbacks + ext-as-key (some repos use that)
  const tryKeys = [
    primaryKey,
    ...(KEY_FALLBACKS[primaryKey] || []),
    ext,
  ].filter(Boolean);

  for (const k of tryKeys) {
    try {
      const url = iconUrlForKey(k);
      const dataUrl = await fetchIconAsPngDataUrl(url, 32);
      ICON_CACHE.set(ext, dataUrl);
      safeCacheSave();
      return dataUrl;
    } catch {
      // try next
    }
  }

  return null;
}

async function rerenderIfLoaded() {
  if (!currentRoot) return;

  // Preserve open state
  const openNodeIds = new Set(
    Array.from(elTree.querySelectorAll(".open"))
      .map((x) => x.getAttribute("data-node-id"))
      .filter(Boolean),
  );

  renderTree(currentRoot);

  // Properly restore: open + render children
  await restoreOpenState(openNodeIds);
}

// init advanced icons
(function initAdvancedIcons() {
  safeCacheLoad();

  if (!window.EXT_TO_ICONKEY) {
    // not fatal, but helpful
    console.warn(
      "EXT_TO_ICONKEY not found. Make sure icons-map.js is loaded before app.js",
    );
  }

  const saved = localStorage.getItem("sv_adv_icons") === "1";
  advancedIconsEnabled = saved;

  if (advancedIconsToggle) {
    advancedIconsToggle.checked = saved;
    advancedIconsToggle.addEventListener("change", async () => {
      advancedIconsEnabled = advancedIconsToggle.checked;
      localStorage.setItem("sv_adv_icons", advancedIconsEnabled ? "1" : "0");
      await rerenderIfLoaded();
    });
  }
})();

// ------------------------
// Folder mode (File System Access API)
// ------------------------

async function buildFolderRoot(dirHandle) {
  return {
    id: makeId(),
    label: dirHandle.name || "(selected folder)",
    type: "folder",
    children: [],
    hasChildren: true,
    loaded: false,
    fsHandle: dirHandle,
    source: "fs",
  };
}

async function loadFolderChildren(node) {
  if (!node.fsHandle || node.fsHandle.kind !== "directory") return;

  const dirs = [];
  const files = [];

  for await (const [name, handle] of node.fsHandle.entries()) {
    if (handle.kind === "directory") {
      dirs.push({
        id: makeId(),
        label: name,
        type: "folder",
        children: [],
        hasChildren: true,
        loaded: false,
        fsHandle: handle,
        source: "fs",
      });
    } else {
      files.push({
        id: makeId(),
        label: name,
        type: "file",
        children: [],
        hasChildren: false,
        loaded: true,
        fsHandle: handle,
        source: "fs",
      });
    }
  }

  dirs.sort((a, b) => a.label.localeCompare(b.label));
  files.sort((a, b) => a.label.localeCompare(b.label));
  node.children = [...dirs, ...files];

  // Lightweight peek for empty folders (immediate children only)
  await Promise.all(
    dirs.map(async (d) => {
      try {
        for await (const _ of d.fsHandle.entries()) {
          d.hasChildren = true;
          return;
        }
        d.hasChildren = false;
      } catch {
        d.hasChildren = true;
      }
    }),
  );
}

async function pickFolder() {
  if (!("showDirectoryPicker" in window)) {
    alert("Folder picker not supported in this browser. Use Chrome/Edge.");
    return;
  }

  const dirHandle = await window.showDirectoryPicker();
  currentMode = "folder";
  currentRoot = await buildFolderRoot(dirHandle);

  elMeta.textContent = `Folder: ${currentRoot.label} • loaded: ${humanNow()}`;
  setControlsEnabled(true);
  renderTree(currentRoot);
}

// ------------------------
// GitHub mode (Public repos)
// ------------------------

async function loadGitHubRepo() {
  const repoFull = (ghRepo?.value || "").trim();
  if (!repoFull.includes("/")) {
    alert("Use: owner/repo");
    return;
  }
  const [owner, repo] = repoFull.split("/", 2);
  const branch = (ghBranch?.value || "").trim();

  currentMode = "github";
  elMeta.textContent = `GitHub: ${owner}/${repo}${branch ? "@" + branch : ""} • loading...`;
  setControlsEnabled(false);

  // repo info -> default branch
  const repoInfoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
  );
  if (!repoInfoRes.ok) throw new Error("Repo not found / rate limited.");
  const repoInfo = await repoInfoRes.json();
  const useBranch = branch || repoInfo.default_branch;

  // branch -> sha
  const refRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(useBranch)}`,
  );
  if (!refRes.ok) throw new Error("Branch not found.");
  const ref = await refRes.json();
  const sha = ref.object.sha;

  // tree recursive
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`,
  );
  if (!treeRes.ok) throw new Error("Tree fetch failed (rate limited?)");
  const treeJson = await treeRes.json();

  currentRoot = buildTreeFromGitHubPaths(
    `${owner}/${repo}@${useBranch}`,
    treeJson.tree || [],
  );

  elMeta.textContent = `GitHub: ${owner}/${repo}@${useBranch} • loaded: ${humanNow()}`;
  setControlsEnabled(true);
  renderTree(currentRoot);
}

function buildTreeFromGitHubPaths(rootLabel, entries) {
  const root = {
    id: makeId(),
    label: rootLabel,
    type: "folder",
    children: [],
    hasChildren: true,
    loaded: true, // IMPORTANT: github is fully materialized
    source: "github",
  };

  const dirMap = new Map(); // path -> node
  dirMap.set("", root);

  function getOrCreateDir(path) {
    if (dirMap.has(path)) return dirMap.get(path);
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const parent = getOrCreateDir(parentPath);

    const node = {
      id: makeId(),
      label: name,
      type: "folder",
      children: [],
      hasChildren: true,
      loaded: true, // IMPORTANT: github is fully materialized
      source: "github",
    };

    parent.children.push(node);
    dirMap.set(path, node);
    return node;
  }

  for (const e of entries) {
    if (!e.path) continue;

    const parts = e.path.split("/");
    const parentPath = parts.slice(0, -1).join("/");
    const parent = getOrCreateDir(parentPath);

    if (e.type === "tree") {
      getOrCreateDir(e.path);
    } else {
      parent.children.push({
        id: makeId(),
        label: parts[parts.length - 1],
        type: "file",
        children: [],
        hasChildren: false,
        loaded: true,
        source: "github",
      });
    }
  }

  function sortNode(node) {
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.label.localeCompare(b.label);
    });
    for (const c of node.children) sortNode(c);
    node.hasChildren = node.children.length > 0;
  }

  sortNode(root);
  return root;
}

// ------------------------
// JSON mode
// ------------------------

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function buildJsonTreeFromValue(label, value) {
  const node = {
    id: makeId(),
    label,
    type: "json",
    children: [],
    hasChildren: false,
    loaded: true,
    source: "json",
  };

  if (Array.isArray(value)) {
    node.hasChildren = value.length > 0;

    value.forEach((item, idx) => {
      let nodeName = `[${idx}]`;
      let excludeField = null;

      if (isPlainObject(item)) {
        for (const f of PRIORITY_FIELDS) {
          if (item[f] !== undefined && item[f] !== null) {
            nodeName = String(item[f]);
            excludeField = f;
            break;
          }
        }
      }

      const child = buildJsonTreeFromValue(nodeName, item);

      // Exclude the used field (like your C#) ONLY for that array item
      if (excludeField && isPlainObject(item)) {
        child.children = child.children.filter((c) => c.label !== excludeField);
        child.hasChildren = child.children.length > 0;
      }

      node.children.push(child);
    });

    return node;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    node.hasChildren = keys.length > 0;

    keys.sort((a, b) => a.localeCompare(b));
    for (const k of keys)
      node.children.push(buildJsonTreeFromValue(k, value[k]));
    return node;
  }

  node.label = `${label}: ${value === null ? "null" : String(value)}`;
  node.hasChildren = false;
  node.children = [];
  return node;
}

async function loadJsonFile(file) {
  const text = await file.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (e) {
    alert("Invalid JSON: " + (e?.message || e));
    return;
  }

  currentMode = "json";
  const baseName = file.name.replace(/\.json$/i, "");
  currentRoot = buildJsonTreeFromValue(baseName, parsed);
  currentRoot.hasChildren = currentRoot.children.length > 0;

  elMeta.textContent = `JSON: ${file.name} • loaded: ${humanNow()}`;
  setControlsEnabled(true);
  renderTree(currentRoot);
}

// ------------------------
// Expand/collapse all
// ------------------------

function collapseAll() {
  for (const el of collectAllNodeElements()) setNodeOpenState(el, false);
}

async function expandAll() {
  const queue = [currentRoot];
  while (queue.length) {
    const node = queue.shift();
    const nodeEl = findNodeElementById(node.id);
    if (nodeEl) setNodeOpenState(nodeEl, true);

    if (node.type === "folder" && node.hasChildren && !node.loaded) {
      // local FS only (github folders are loaded=true)
      await loadFolderChildren(node);
      node.loaded = true;
      const childrenWrap = nodeEl?.querySelector(":scope > .children");
      if (childrenWrap) renderChildren(node, childrenWrap);
    } else if ((node.type === "folder" || node.type === "json") && nodeEl) {
      // ensure children rendered so deeper nodes exist
      const childrenWrap = nodeEl.querySelector(":scope > .children");
      if (childrenWrap && childrenWrap.childElementCount === 0) {
        renderChildren(node, childrenWrap);
      }
    }

    for (const ch of node.children) queue.push(ch);
  }
}

// ------------------------
// PNG export helpers
// ------------------------

async function ensureIconsReadyForExport() {
  if (!advancedIconsEnabled) return;

  await new Promise((r) => setTimeout(r, 30));

  const icons = Array.from(elTree.querySelectorAll(".icon[data-icon-ready]"));
  if (icons.length === 0) return;

  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const pending = icons.some((el) => el.dataset.iconReady !== "1");
    if (!pending) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function replaceIconImgsWithCanvases(root, size = 16) {
  const imgs = Array.from(root.querySelectorAll(".icon img"));

  await Promise.all(
    imgs.map(
      (im) =>
        new Promise((resolve) => {
          if (im.complete && im.naturalWidth > 0) return resolve();
          im.onload = () => resolve();
          im.onerror = () => resolve();
        }),
    ),
  );

  for (const im of imgs) {
    if (!(im.naturalWidth > 0 && im.naturalHeight > 0)) continue;

    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;

    const ctx = c.getContext("2d");
    try {
      const iw = im.naturalWidth;
      const ih = im.naturalHeight;
      const scale = Math.min(size / iw, size / ih);
      const w = iw * scale;
      const h = ih * scale;
      const x = (size - w) / 2;
      const y = (size - h) / 2;

      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(im, x, y, w, h);
    } catch {
      continue;
    }

    c.style.width = size + "px";
    c.style.height = size + "px";
    c.style.display = "block";
    c.style.imageRendering = "auto";

    im.replaceWith(c);
  }
}

// ------------------------
// PNG export (fit width to content, no “thin line” bug)
// ------------------------

async function exportPng({ full }) {
  if (!currentRoot) return;

  try {
    if (typeof html2canvas !== "function") {
      alert("html2canvas is not loaded. Check script order in index.html.");
      return;
    }

    const treeWrap = document.getElementById("treeWrap");
    if (!treeWrap) {
      alert("Missing #treeWrap element.");
      return;
    }

    // store open state
    const openNodeIds = new Set(
      Array.from(elTree.querySelectorAll(".open"))
        .map((x) => x.getAttribute("data-node-id"))
        .filter(Boolean),
    );

    if (full) {
      btnExportFull.disabled = true;
      btnExportView.disabled = true;
      btnExpandAll.disabled = true;
      btnCollapseAll.disabled = true;

      await expandAll();
      await new Promise((r) => setTimeout(r, 60));
    }

    // wait for icons in LIVE DOM so clone will have final <img src="data:...">
    await ensureIconsReadyForExport();

    const effectiveTheme = getEffectiveTheme();
    const tv = themeVars(effectiveTheme);

    const useBg = exportUseThemeBg?.checked ?? true;
    const pad = 12;
    const MAX_W = 6000;

    // Off-screen host (measurable)
    const cloneHost = document.createElement("div");
    cloneHost.style.position = "fixed";
    cloneHost.style.left = "0";
    cloneHost.style.top = "0";
    cloneHost.style.transform = "translateX(-200%)";
    cloneHost.style.padding = pad + "px";
    cloneHost.style.fontFamily = getComputedStyle(document.body).fontFamily;

    // fit-to-content
    cloneHost.style.display = "inline-block";
    cloneHost.style.width = "auto";
    cloneHost.style.maxWidth = "none";
    cloneHost.style.overflow = "visible";

    setThemeOnElement(cloneHost, tv);
    cloneHost.style.background = useBg ? tv.bg : "transparent";
    cloneHost.style.color = tv.text;

    const clone = elTree.cloneNode(true);
    cloneHost.appendChild(clone);

    // icon box sizing inside clone
    cloneHost.querySelectorAll(".icon").forEach((el) => {
      el.style.width = "16px";
      el.style.height = "16px";
      el.style.minWidth = "16px";
      el.style.display = "inline-flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.overflow = "hidden";
    });

    // clamp <img> sizes inside clone
    cloneHost.querySelectorAll(".icon img").forEach((im) => {
      im.style.width = "16px";
      im.style.height = "16px";
      im.width = 16;
      im.height = 16;
      im.style.display = "block";
    });

    document.body.appendChild(cloneHost);

    await new Promise((r) => requestAnimationFrame(() => r()));

    // convert icons <img> -> <canvas> for html2canvas reliability
    await replaceIconImgsWithCanvases(cloneHost, 16);

    await new Promise((r) => requestAnimationFrame(() => r()));

    // measure width via bounding box (no scrollWidth gotchas)
    const treeBox = clone.getBoundingClientRect();
    let contentW = Math.ceil(treeBox.width);
    if (!contentW || contentW < 50) {
      contentW = Math.ceil(cloneHost.getBoundingClientRect().width) || 800;
    }

    const fitW = Math.min(contentW + pad * 2, MAX_W);
    cloneHost.style.width = fitW + "px";

    await new Promise((r) => requestAnimationFrame(() => r()));

    const rect = cloneHost.getBoundingClientRect();
    const canvas = await html2canvas(cloneHost, {
      backgroundColor: useBg ? tv.bg : null,
      scale: window.devicePixelRatio || 1,
      useCORS: true,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      windowWidth: Math.ceil(rect.width),
      windowHeight: Math.ceil(rect.height),
    });

    document.body.removeChild(cloneHost);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );

    const safeName = (currentRoot.label || "structure").replace(
      /[^\w\-]+/g,
      "_",
    );
    const suffix = full ? "full" : "view";
    const filename = `${safeName}_${suffix}.png`;

    if (blob) {
      downloadBlob(blob, filename);
    } else {
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    if (full) {
      collapseAll();
      // best-effort restore open state visually
      await restoreOpenState(openNodeIds);
    }
  } catch (err) {
    console.error(err);
    alert(
      "Export failed. Open DevTools Console for details.\n\n" +
        (err?.message || err),
    );
  } finally {
    if (currentRoot) {
      btnExportFull.disabled = false;
      btnExportView.disabled = false;
      btnExpandAll.disabled = false;
      btnCollapseAll.disabled = false;
    }
  }
}

// ------------------------
// Theme init
// ------------------------

(function initTheme() {
  const saved = localStorage.getItem("sv_theme") || "system";
  if (themeSelect) themeSelect.value = saved;
  applyTheme(saved);

  themeSelect?.addEventListener("change", (e) => {
    applyTheme(e.target.value);
  });

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", () => {
      const cur = localStorage.getItem("sv_theme") || "system";
      if (cur === "system") applyTheme("system");
    });
  }
})();

// ------------------------
// Events
// ------------------------

btnPickFolder?.addEventListener("click", async () => {
  try {
    await pickFolder();
  } catch (e) {
    console.warn(e);
  }
});

btnLoadGitHub?.addEventListener("click", () => {
  loadGitHubRepo().catch((e) => {
    console.error(e);
    alert(e?.message || e);
    elMeta.textContent = "Failed to load GitHub repo.";
    setControlsEnabled(false);
  });
});

jsonInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await loadJsonFile(file);
  jsonInput.value = "";
});

btnCollapseAll?.addEventListener("click", () => collapseAll());

btnExpandAll?.addEventListener("click", async () => {
  btnExpandAll.disabled = true;
  try {
    await expandAll();
  } finally {
    btnExpandAll.disabled = false;
  }
});

btnExportView?.addEventListener("click", async () =>
  exportPng({ full: false }),
);
btnExportFull?.addEventListener("click", async () => exportPng({ full: true }));

// start clean
clearTree();
