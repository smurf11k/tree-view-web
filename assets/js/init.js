// ------------------------
// Advanced Icons Toggle
// ------------------------

(function initAdvancedIcons() {
  if (!window.EXT_TO_ICONKEY) {
    console.warn(
      "EXT_TO_ICONKEY not found. Make sure icons-map.js is loaded before app scripts.",
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

// ------------------------
// Fixed Height / Tree Layout
// ------------------------

const lockCheckbox = document.getElementById("lockTreeHeight");

function syncTreeHeight() {
  const layout = document.querySelector(".layout");
  const treeWrap = document.getElementById("treeWrap");
  if (!layout || !treeWrap || !lockCheckbox) return;

  layout.dataset.fixed = lockCheckbox.checked ? "true" : "false";

  // Clear any stale inline styles
  treeWrap.style.height = "";
  treeWrap.style.maxHeight = "";
  treeWrap.style.overflowY = "";
  treeWrap.style.overflow = "";
}

lockCheckbox?.addEventListener("change", syncTreeHeight);
window.addEventListener("resize", syncTreeHeight);
requestAnimationFrame(syncTreeHeight);

// ------------------------
// Clear-All Buttons
// ------------------------

(function initClearButtons() {
  const lockEl = lockCheckbox?.closest("label") ?? lockCheckbox;
  if (!lockEl) return;

  const controlsWrap =
    lockEl.closest(".panel-header-controls") ?? lockEl.parentNode;

  const sep = document.createElement("span");
  sep.className = "sep";
  controlsWrap.appendChild(sep);

  const btnClearColors = document.createElement("button");
  btnClearColors.textContent = "🗑 Colors";
  btnClearColors.className = "btn-clear-all";
  btnClearColors.title = "Remove all highlights and their legend labels";

  const btnClearLegend = document.createElement("button");
  btnClearLegend.textContent = "🗑 Legend";
  btnClearLegend.className = "btn-clear-all";
  btnClearLegend.title = "Remove all legend labels (keeps colors)";

  const btnClearComments = document.createElement("button");
  btnClearComments.textContent = "🗑 Comments";
  btnClearComments.className = "btn-clear-all";
  btnClearComments.title = "Remove all comments";

  controlsWrap.appendChild(btnClearColors);
  controlsWrap.appendChild(btnClearLegend);
  controlsWrap.appendChild(btnClearComments);

  btnClearColors.addEventListener("click", () => {
    if (!confirm("Clear all highlights and legend labels?")) return;
    nodeColors.clear();
    nodeFolderColors.clear();
    colorLegend.clear();
    saveColors();
    saveFolderColors();
    saveLegend();
    rerenderIfLoaded();
    renderLiveLegend();
  });

  btnClearLegend.addEventListener("click", () => {
    if (!confirm("Clear all legend labels? Colors will be kept.")) return;
    colorLegend.clear();
    saveLegend();
    renderLiveLegend();
  });

  btnClearComments.addEventListener("click", () => {
    if (!confirm("Clear all comments?")) return;
    nodeComments.clear();
    saveComments();
    rerenderIfLoaded();
  });
})();

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

// ------------------------
// Notes Panel Toggle
// ------------------------

(function initNotesToggle() {
  const NOTES_KEY = "sv_notes_collapsed";
  const notesPanel = document.querySelector(".panel.side");
  const closeBtn = document.getElementById("notesCloseBtn");
  if (!notesPanel || !closeBtn) return;

  // Reopen button — injected into the layout, only visible when panel is hidden
  const reopenBtn = document.createElement("button");
  reopenBtn.className = "notes-reopen-btn";
  reopenBtn.title = "Show notes";
  reopenBtn.innerHTML = '<i class="bi bi-journal-text"></i>';
  notesPanel.parentNode.appendChild(reopenBtn);

  function setCollapsed(collapsed, save = true) {
    const layout = notesPanel.closest(".layout");
    notesPanel.classList.toggle("notes-panel--collapsed", collapsed);
    layout?.classList.toggle("notes-hidden", collapsed);
    reopenBtn.classList.toggle("notes-reopen-btn--visible", collapsed);
    if (save) localStorage.setItem(NOTES_KEY, collapsed ? "1" : "0");
    syncTreeHeight();
  }

  closeBtn.addEventListener("click", () => setCollapsed(true));
  reopenBtn.addEventListener("click", () => setCollapsed(false));

  // Restore saved state
  setCollapsed(localStorage.getItem(NOTES_KEY) === "1", false);
})();

// ------------------------
// Startup
// ------------------------

// start clean
clearTree();

// Ensure legend is hidden on startup regardless of localStorage state
(function () {
  const treeWrap = document.getElementById("treeWrap");
  if (!treeWrap) return;
  let container = document.getElementById("legendWrap");
  if (!container) {
    container = document.createElement("div");
    container.id = "legendWrap";
    container.style.padding = "0 12px 12px";
    treeWrap.parentNode.insertBefore(container, treeWrap.nextSibling);
  }
  container.style.display = "none";
  container.innerHTML = "";
})();
