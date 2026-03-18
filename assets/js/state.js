let currentRoot = null; // generic node model
let currentMode = null; // "folder" | "json" | "github" | "zip"
let advancedIconsEnabled = false;
let nodeIdCounter = 0;

// nodeComments: Map<nodeId, string>
const nodeComments = (function loadComments() {
  try {
    const raw = localStorage.getItem(CONFIG.COMMENTS_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw));
  } catch {
    return new Map();
  }
})();

function saveComments() {
  try {
    localStorage.setItem(
      CONFIG.COMMENTS_KEY,
      JSON.stringify(Array.from(nodeComments.entries())),
    );
  } catch {}
}

// nodeColors: Map<nodeId, string> — hex color
const nodeColors = (function loadColors() {
  try {
    const raw = localStorage.getItem(CONFIG.COLORS_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw));
  } catch {
    return new Map();
  }
})();

function saveColors() {
  try {
    localStorage.setItem(
      CONFIG.COLORS_KEY,
      JSON.stringify(Array.from(nodeColors.entries())),
    );
  } catch {}
}

// nodeFolderColors: Map<nodeId, string> — folder-wide highlight
const nodeFolderColors = (function loadFolderColors() {
  try {
    const raw = localStorage.getItem(CONFIG.FOLDER_COLORS_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw));
  } catch {
    return new Map();
  }
})();

function saveFolderColors() {
  try {
    localStorage.setItem(
      CONFIG.FOLDER_COLORS_KEY,
      JSON.stringify(Array.from(nodeFolderColors.entries())),
    );
  } catch {}
}

// colorLegend: Map<hexColor, labelString>
const colorLegend = (function loadLegend() {
  try {
    const raw = localStorage.getItem(CONFIG.LEGEND_KEY);
    if (!raw) return new Map();
    return new Map(JSON.parse(raw));
  } catch {
    return new Map();
  }
})();

function saveLegend() {
  try {
    localStorage.setItem(
      CONFIG.LEGEND_KEY,
      JSON.stringify(Array.from(colorLegend.entries())),
    );
  } catch {}
}

// Returns the set of colors currently in use across the tree
function getUsedColors() {
  const used = new Set();
  for (const v of nodeColors.values()) used.add(v);
  for (const v of nodeFolderColors.values()) used.add(v);
  return used;
}
