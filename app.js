// Structure Viewer
// - Folder tree via File System Access API (showDirectoryPicker), lazy loads subfolders.
// - JSON tree via file input.
// - ZIP tree via JSZip.
// - GitHub public repo tree via GitHub API (single recursive tree call).
// - Export PNG via html2canvas (view or full), including advanced icons.

// ------------------------
// Constants
// ------------------------

const CONFIG = {
  ICON_SIZE: 16,
  ICON_CACHE_MAX: 200,
  ICON_CACHE_KEY: "sv_icon_cache_v1",
  THEME_KEY: "sv_theme",
  ADVANCED_ICONS_KEY: "sv_adv_icons",
  EXPORT_MAX_WIDTH: 6000,
  EXPORT_PADDING: 12,
  ICON_LOAD_TIMEOUT: 2500,
  ICON_CANVAS_SIZE: 32,
};

const EMOJI = {
  LOADING: "⏳",
  ERROR: "!",
  WARNING: "⚠️",
  FOLDER: "📁",
  FILE: "📄",
  JSON: "🔹",
};

const TWISTY = {
  COLLAPSED: "▶",
  EXPANDED: "▼",
  LEAF: "•",
};

const PRIORITY_FIELDS = ["name", "username", "title", "id"];

const VSCODE_ICONS_BASE =
  "https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/";

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

const COMPOUND_EXTENSIONS = ["csproj.user", "vbproj.user", "tar.gz", "tar.bz2"];

// ------------------------
// DOM Elements
// ------------------------

const elTree = document.getElementById("tree");
const elMeta = document.getElementById("meta");

const btnPickFolder = document.getElementById("btnPickFolder");
const jsonInput = document.getElementById("jsonInput");
const zipInput = document.getElementById("zipInput");

const btnCollapseAll = document.getElementById("btnCollapseAll");
const btnExpandAll = document.getElementById("btnExpandAll");
const btnExportView = document.getElementById("btnExportView");
const btnExportFull = document.getElementById("btnExportFull");

const btnLoadGitHub = document.getElementById("btnLoadGitHub");
const ghRepo = document.getElementById("ghRepo");
const ghBranch = document.getElementById("ghBranch");

const themeSelect = document.getElementById("themeSelect");
const exportUseThemeBg = document.getElementById("exportUseThemeBg");
const advancedIconsToggle = document.getElementById("advancedIcons");

// ------------------------
// State
// ------------------------

let currentRoot = null; // generic node model
let currentMode = null; // "folder" | "json" | "github" | "zip"
let advancedIconsEnabled = false;
let nodeIdCounter = 0;

// ------------------------
// Utility Functions
// ------------------------

function makeId() {
  nodeIdCounter += 1;
  return `n_${nodeIdCounter}`;
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

function getFileExtension(name) {
  const base = name.split("/").pop();

  // Check for compound extensions first (e.g., .csproj.user, .tar.gz)
  for (const ext of COMPOUND_EXTENSIONS) {
    if (base.toLowerCase().endsWith("." + ext)) {
      return ext;
    }
  }

  // Standard single extension
  const i = base.lastIndexOf(".");
  if (i <= 0 || i === base.length - 1) return "";
  return base.slice(i + 1).toLowerCase();
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function handleError(error, context, userMessage) {
  console.error(`[${context}]`, error);
  if (userMessage) {
    alert(userMessage + "\n\n" + (error?.message || error));
  }
}

// ------------------------
// Icon Manager Class
// ------------------------

class IconManager {
  constructor() {
    this.cache = new Map();
    this.loadCacheFromStorage();
  }

  loadCacheFromStorage() {
    try {
      const raw = localStorage.getItem(CONFIG.ICON_CACHE_KEY);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      for (const [k, v] of arr) this.cache.set(k, v);
    } catch {}
  }

  saveCacheToStorage() {
    try {
      const arr = Array.from(this.cache.entries()).slice(
        -CONFIG.ICON_CACHE_MAX,
      );
      localStorage.setItem(CONFIG.ICON_CACHE_KEY, JSON.stringify(arr));
    } catch {}
  }

  async getIconDataUrl(ext) {
    if (!ext) return null;
    if (this.cache.has(ext)) return this.cache.get(ext);

    const EXT_TO_ICONKEY = window.EXT_TO_ICONKEY || {};
    const primaryKey = EXT_TO_ICONKEY[ext];
    if (!primaryKey) return null;

    const tryKeys = [
      primaryKey,
      ...(KEY_FALLBACKS[primaryKey] || []),
      ext,
    ].filter(Boolean);

    for (const k of tryKeys) {
      try {
        const url = this.getIconUrl(k);
        const dataUrl = await this.fetchIconAsPngDataUrl(url);
        this.cache.set(ext, dataUrl);
        this.saveCacheToStorage();
        return dataUrl;
      } catch {
        continue;
      }
    }

    return null;
  }

  getIconUrl(key) {
    return `${VSCODE_ICONS_BASE}file_type_${key}.svg`;
  }

  async fetchIconAsPngDataUrl(url, size = CONFIG.ICON_CANVAS_SIZE) {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`Icon fetch failed: ${res.status}`);
    const svgText = await res.text();

    const normalizedSvg = svgText.includes('xmlns="http://www.w3.org/2000/svg"')
      ? svgText
      : svgText.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

    const svgDataUrl =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(normalizedSvg);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.crossOrigin = "anonymous";

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
}

const iconManager = new IconManager();

// ------------------------
// Node Factory
// ------------------------

const NodeFactory = {
  createFolder(label, options = {}) {
    return {
      id: makeId(),
      label,
      type: "folder",
      children: [],
      hasChildren: true,
      loaded: false,
      ...options,
    };
  },

  createFile(label, options = {}) {
    return {
      id: makeId(),
      label,
      type: "file",
      children: [],
      hasChildren: false,
      loaded: true,
      ...options,
    };
  },

  createJson(label, options = {}) {
    return {
      id: makeId(),
      label,
      type: "json",
      children: [],
      hasChildren: false,
      loaded: true,
      source: "json",
      ...options,
    };
  },
};

// ------------------------
// UI Control Functions
// ------------------------

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

// ------------------------
// Icon Creation
// ------------------------

function iconFor(node) {
  if (node.type === "folder") return { kind: "emoji", value: EMOJI.FOLDER };
  if (node.type === "json") return { kind: "emoji", value: EMOJI.JSON };

  if (node.type === "file") {
    if (!advancedIconsEnabled) return { kind: "emoji", value: EMOJI.FILE };
    return { kind: "lazy-web-icon", value: node.label };
  }

  return { kind: "emoji", value: EMOJI.JSON };
}

function createPlaceholderImage() {
  const img = document.createElement("img");
  img.alt = "";
  img.width = CONFIG.ICON_SIZE;
  img.height = CONFIG.ICON_SIZE;
  img.decoding = "async";
  img.loading = "lazy";
  img.style.verticalAlign = "middle";
  img.style.display = "inline-block";
  return img;
}

async function loadIconForElement(icon, img, ext) {
  try {
    const dataUrl = await iconManager.getIconDataUrl(ext);

    if (!dataUrl) {
      icon.textContent = EMOJI.FILE;
      icon.dataset.iconReady = "1";
      return;
    }

    const targetImg = icon.querySelector("img") || img;
    targetImg.onload = () => (icon.dataset.iconReady = "1");
    targetImg.onerror = () => {
      icon.textContent = EMOJI.FILE;
      icon.dataset.iconReady = "1";
    };
    targetImg.src = dataUrl;

    if (targetImg.complete && targetImg.naturalWidth > 0) {
      icon.dataset.iconReady = "1";
    }
  } catch {
    icon.textContent = EMOJI.FILE;
    icon.dataset.iconReady = "1";
  }
}

function createLazyIconElement(fileName) {
  const icon = document.createElement("span");
  icon.className = "icon";
  icon.textContent = "";

  const ext = getFileExtension(fileName);
  icon.dataset.ext = ext || "";
  icon.dataset.iconReady = "0";

  const img = createPlaceholderImage();
  icon.appendChild(img);

  if (!ext) {
    icon.textContent = EMOJI.FILE;
    icon.dataset.iconReady = "1";
    return icon;
  }

  loadIconForElement(icon, img, ext);
  return icon;
}

function createIconElement(node) {
  const icon = document.createElement("span");
  icon.className = "icon";

  const ico = iconFor(node);

  if (ico.kind === "emoji") {
    icon.textContent = ico.value;
    return icon;
  }

  if (ico.kind === "lazy-web-icon") {
    return createLazyIconElement(ico.value);
  }

  return icon;
}

// ------------------------
// Node Rendering
// ------------------------

function createNodeElement(node) {
  const container = document.createElement("div");
  container.className = "treeItem";
  container.dataset.nodeId = node.id;

  const row = document.createElement("div");
  row.className = "node";

  const twisty = document.createElement("span");
  twisty.className = "twisty";
  twisty.textContent = node.hasChildren ? TWISTY.COLLAPSED : TWISTY.LEAF;
  if (!node.hasChildren) twisty.classList.add("hidden");

  const icon = createIconElement(node);

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
      await handleNodeToggle(node, container, twisty, childrenWrap);
    });
  }

  return container;
}

async function handleNodeToggle(node, container, twisty, childrenWrap) {
  // don't toggle if user selects text
  const sel = window.getSelection?.();
  if (sel && sel.toString()) return;

  const isOpen = container.classList.contains("open");
  if (isOpen) {
    container.classList.remove("open");
    twisty.textContent = TWISTY.COLLAPSED;
    return;
  }

  // opening:
  container.classList.add("open");
  twisty.textContent = TWISTY.EXPANDED;

  // JSON nodes: always have children ready
  if (node.type === "json") {
    renderChildren(node, childrenWrap);
    return;
  }

  // Folder nodes:
  if (node.type === "folder") {
    // GitHub/ZIP folders (pre-built tree) must render immediately
    if (node.loaded) {
      renderChildren(node, childrenWrap);
      return;
    }

    // local FS folders: lazy load
    twisty.textContent = EMOJI.LOADING;
    try {
      await loadFolderChildren(node);
      node.loaded = true;
      renderChildren(node, childrenWrap);
      twisty.textContent = TWISTY.EXPANDED;
    } catch (err) {
      console.error(err);
      twisty.textContent = EMOJI.ERROR;
      childrenWrap.innerHTML = `<div class="node"><span class="twisty hidden">${TWISTY.LEAF}</span><span class="icon">${EMOJI.WARNING}</span><span class="label">Failed to read folder (permissions?)</span></div>`;
    }
  }
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
    if (!twisty.classList.contains("hidden"))
      twisty.textContent = TWISTY.EXPANDED;
  } else {
    nodeEl.classList.remove("open");
    if (!twisty.classList.contains("hidden"))
      twisty.textContent = TWISTY.COLLAPSED;
  }
}

function collectAllNodeElements() {
  return Array.from(elTree.querySelectorAll("[data-node-id]"));
}

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

// ------------------------
// Theme Management
// ------------------------

function applyTheme(mode) {
  // mode: "system" | "dark" | "light"
  if (mode === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }
  localStorage.setItem(CONFIG.THEME_KEY, mode);
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
// Folder Mode (File System Access API)
// ------------------------

async function buildFolderRoot(dirHandle) {
  return NodeFactory.createFolder(dirHandle.name || "(selected folder)", {
    fsHandle: dirHandle,
    source: "fs",
  });
}

async function loadFolderChildren(node) {
  if (!node.fsHandle || node.fsHandle.kind !== "directory") return;

  const dirs = [];
  const files = [];

  for await (const [name, handle] of node.fsHandle.entries()) {
    if (handle.kind === "directory") {
      dirs.push(
        NodeFactory.createFolder(name, {
          fsHandle: handle,
          source: "fs",
        }),
      );
    } else {
      files.push(
        NodeFactory.createFile(name, {
          fsHandle: handle,
          source: "fs",
        }),
      );
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
// Generic Tree Building (GitHub & ZIP)
// ------------------------

function buildTreeFromPaths(rootLabel, entries, source) {
  const root = NodeFactory.createFolder(rootLabel, {
    loaded: true,
    source,
  });

  const dirMap = new Map();
  dirMap.set("", root);

  function getOrCreateDir(path) {
    if (dirMap.has(path)) return dirMap.get(path);
    const parts = path.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const parent = getOrCreateDir(parentPath);

    const node = NodeFactory.createFolder(name, {
      loaded: true,
      source,
    });

    parent.children.push(node);
    dirMap.set(path, node);
    return node;
  }

  // Process entries
  entries.forEach((entry) => {
    const path = entry.path || entry;
    if (!path || path.endsWith("/")) {
      if (path && path !== "/") {
        getOrCreateDir(path.slice(0, -1));
      }
      return;
    }

    const parts = path.split("/");
    const parentPath = parts.slice(0, -1).join("/");
    const parent = getOrCreateDir(parentPath);

    // For GitHub, check if it's a tree type
    if (entry.type === "tree") {
      getOrCreateDir(path);
      return;
    }

    parent.children.push(
      NodeFactory.createFile(parts[parts.length - 1], {
        source,
      }),
    );
  });

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
// GitHub Mode
// ------------------------

function buildTreeFromGitHubPaths(rootLabel, entries) {
  return buildTreeFromPaths(rootLabel, entries, "github");
}

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

// ------------------------
// ZIP Mode
// ------------------------

function buildTreeFromZipEntries(zipName, files) {
  const rootLabel = zipName.replace(/\.zip$/i, "");
  const entries = Object.keys(files);
  return buildTreeFromPaths(rootLabel, entries, "zip");
}

async function loadZipFile(file) {
  try {
    const zip = await JSZip.loadAsync(file);

    currentMode = "zip";
    currentRoot = buildTreeFromZipEntries(file.name, zip.files);

    elMeta.textContent = `ZIP: ${file.name} • loaded: ${humanNow()}`;
    setControlsEnabled(true);
    renderTree(currentRoot);
  } catch (e) {
    handleError(e, "ZIP Load", "Failed to read ZIP file");
  }
}

// ------------------------
// JSON Mode
// ------------------------

function buildJsonTreeFromValue(label, value) {
  const node = NodeFactory.createJson(label);

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

      // Exclude the used field ONLY for that array item
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
    for (const k of keys) {
      node.children.push(buildJsonTreeFromValue(k, value[k]));
    }
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
    handleError(e, "JSON Parse", "Invalid JSON");
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
// Expand/Collapse All
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
      // local FS only (github/zip folders are loaded=true)
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
// PNG Export Helpers
// ------------------------

async function ensureIconsReadyForExport() {
  if (!advancedIconsEnabled) return;

  await new Promise((r) => setTimeout(r, 30));

  const icons = Array.from(elTree.querySelectorAll(".icon[data-icon-ready]"));
  if (icons.length === 0) return;

  const deadline = Date.now() + CONFIG.ICON_LOAD_TIMEOUT;
  while (Date.now() < deadline) {
    const pending = icons.some((el) => el.dataset.iconReady !== "1");
    if (!pending) return;
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function replaceIconImgsWithCanvases(root, size = CONFIG.ICON_SIZE) {
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
// PNG Export
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
    const pad = CONFIG.EXPORT_PADDING;
    const MAX_W = CONFIG.EXPORT_MAX_WIDTH;

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
      el.style.width = CONFIG.ICON_SIZE + "px";
      el.style.height = CONFIG.ICON_SIZE + "px";
      el.style.minWidth = CONFIG.ICON_SIZE + "px";
      el.style.display = "inline-flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.overflow = "hidden";
    });

    // clamp <img> sizes inside clone
    cloneHost.querySelectorAll(".icon img").forEach((im) => {
      im.style.width = CONFIG.ICON_SIZE + "px";
      im.style.height = CONFIG.ICON_SIZE + "px";
      im.width = CONFIG.ICON_SIZE;
      im.height = CONFIG.ICON_SIZE;
      im.style.display = "block";
    });

    document.body.appendChild(cloneHost);

    await new Promise((r) => requestAnimationFrame(() => r()));

    // convert icons <img> -> <canvas> for html2canvas reliability
    await replaceIconImgsWithCanvases(cloneHost, CONFIG.ICON_SIZE);

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
    handleError(err, "PNG Export", "Export failed. Check console for details.");
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
// Initialization
// ------------------------

(function initTheme() {
  const saved = localStorage.getItem(CONFIG.THEME_KEY) || "system";
  if (themeSelect) themeSelect.value = saved;
  applyTheme(saved);

  themeSelect?.addEventListener("change", (e) => {
    applyTheme(e.target.value);
  });

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", () => {
      const cur = localStorage.getItem(CONFIG.THEME_KEY) || "system";
      if (cur === "system") applyTheme("system");
    });
  }
})();

(function initAdvancedIcons() {
  if (!window.EXT_TO_ICONKEY) {
    console.warn(
      "EXT_TO_ICONKEY not found. Make sure icons-map.js is loaded before app.js",
    );
  }

  const saved = localStorage.getItem(CONFIG.ADVANCED_ICONS_KEY) === "1";
  advancedIconsEnabled = saved;

  if (advancedIconsToggle) {
    advancedIconsToggle.checked = saved;
    advancedIconsToggle.addEventListener("change", async () => {
      advancedIconsEnabled = advancedIconsToggle.checked;
      localStorage.setItem(
        CONFIG.ADVANCED_ICONS_KEY,
        advancedIconsEnabled ? "1" : "0",
      );
      await rerenderIfLoaded();
    });
  }
})();

const lockCheckbox = document.getElementById("lockTreeHeight");
function syncTreeHeight() {
  const panel = document.querySelector(".panel");
  const sidePanel = document.querySelector(".panel.side");
  const treeWrap = document.getElementById("treeWrap");
  if (!panel || !treeWrap || !lockCheckbox) return;

  panel.dataset.fixed = lockCheckbox.checked ? "true" : "false";

  if (lockCheckbox.checked) {
    const lockRect = (sidePanel || panel).getBoundingClientRect();
    const treeRect = treeWrap.getBoundingClientRect();
    const availableHeight = Math.max(
      0,
      Math.floor(lockRect.bottom - treeRect.top),
    );

    treeWrap.style.height = `${availableHeight}px`;
    treeWrap.style.maxHeight = `${availableHeight}px`;
    treeWrap.style.overflowY = "auto";
  } else {
    treeWrap.style.height = "";
    treeWrap.style.maxHeight = "";
    treeWrap.style.overflowY = "";
    treeWrap.style.overflow = "";
  }
}

lockCheckbox?.addEventListener("change", syncTreeHeight);
window.addEventListener("resize", syncTreeHeight);
requestAnimationFrame(syncTreeHeight);

// ------------------------
// Event Listeners
// ------------------------

btnPickFolder?.addEventListener("click", async () => {
  try {
    await pickFolder();
  } catch (e) {
    handleError(e, "Folder Picker");
  }
});

btnLoadGitHub?.addEventListener("click", () => {
  loadGitHubRepo().catch((e) => {
    handleError(e, "GitHub Load", "Failed to load GitHub repository");
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

zipInput?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await loadZipFile(file);
  zipInput.value = "";
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
