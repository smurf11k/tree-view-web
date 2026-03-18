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
