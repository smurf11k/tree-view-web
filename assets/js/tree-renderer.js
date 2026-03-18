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
  renderLiveLegend();
}

// ------------------------
// Folder Color Helper
// ------------------------

function applyFolderColor(childrenWrap, color) {
  if (color) {
    childrenWrap.style.setProperty("--folder-highlight", color + "18");
    childrenWrap.style.setProperty("--folder-highlight-border", color);
    childrenWrap.classList.add("children-highlighted");
  } else {
    childrenWrap.style.removeProperty("--folder-highlight");
    childrenWrap.style.removeProperty("--folder-highlight-border");
    childrenWrap.classList.remove("children-highlighted");
  }
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

  // --- Comment annotation (shown when a comment exists) ---
  const commentAnnotation = document.createElement("span");
  commentAnnotation.className = "node-comment-annotation";
  const existingComment = nodeComments.get(node.id) || "";
  commentAnnotation.textContent = existingComment ? `← ${existingComment}` : "";
  commentAnnotation.style.display = existingComment ? "" : "none";

  // --- Add comment button (shown on row hover) ---
  const commentBtn = document.createElement("button");
  commentBtn.className = "node-comment-btn";
  commentBtn.title = "Add / edit comment";
  commentBtn.textContent = "💬";
  commentBtn.setAttribute("aria-label", "Edit comment");

  // --- Inline editor (hidden until button clicked) ---
  const commentEditor = document.createElement("span");
  commentEditor.className = "node-comment-editor";
  commentEditor.style.display = "none";

  const commentInput = document.createElement("input");
  commentInput.type = "text";
  commentInput.className = "node-comment-input";
  commentInput.placeholder = "Add a comment…";
  commentInput.value = existingComment;
  commentInput.maxLength = 120;

  const confirmBtn = document.createElement("button");
  confirmBtn.className = "node-comment-confirm";
  confirmBtn.textContent = "✓";
  confirmBtn.title = "Save comment";

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "node-comment-delete";
  deleteBtn.textContent = "✕";
  deleteBtn.title = "Remove comment";

  commentEditor.appendChild(commentInput);
  commentEditor.appendChild(confirmBtn);
  commentEditor.appendChild(deleteBtn);

  function openEditor(e) {
    e.stopPropagation();
    const isOpen = commentEditor.style.display !== "none";
    if (isOpen) {
      commentEditor.style.display = "none";
      commentAnnotation.style.display = nodeComments.has(node.id) ? "" : "none";
      return;
    }
    commentEditor.style.display = "";
    commentAnnotation.style.display = "none";
    commentInput.value = nodeComments.get(node.id) || "";
    commentInput.focus();
    commentInput.select();
  }

  function saveComment(e) {
    if (e) e.stopPropagation();
    const val = commentInput.value.trim();
    if (val) {
      nodeComments.set(node.id, val);
      commentAnnotation.textContent = `← ${val}`;
      commentAnnotation.style.display = "";
    } else {
      nodeComments.delete(node.id);
      commentAnnotation.textContent = "";
      commentAnnotation.style.display = "none";
    }
    saveComments();
    commentEditor.style.display = "none";
  }

  function deleteComment(e) {
    if (e) e.stopPropagation();
    commentInput.value = "";
    saveComment();
  }

  commentBtn.addEventListener("click", openEditor);
  confirmBtn.addEventListener("click", saveComment);
  deleteBtn.addEventListener("click", deleteComment);

  commentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveComment(e);
    if (e.key === "Escape") {
      e.stopPropagation();
      commentEditor.style.display = "none";
      commentAnnotation.style.display = nodeComments.has(node.id) ? "" : "none";
    }
  });

  // Stop row click from toggling folder when clicking anywhere in editor
  commentEditor.addEventListener("click", (e) => e.stopPropagation());

  // --- Apply existing highlight color to row ---
  const existingColor = nodeColors.get(node.id);
  if (existingColor) {
    row.style.setProperty("--node-highlight", existingColor + "22");
    row.style.setProperty("--node-highlight-border", existingColor);
    row.classList.add("node-highlighted");
  }

  // --- Color picker button (shown on row hover) ---
  const colorBtn = document.createElement("button");
  colorBtn.className = "node-color-btn";
  colorBtn.title = "Highlight color";
  colorBtn.textContent = "🎨";
  colorBtn.setAttribute("aria-label", "Pick highlight color");

  // --- Color palette (hidden until colorBtn clicked) ---
  const colorPalette = document.createElement("span");
  colorPalette.className = "node-color-palette";
  colorPalette.style.display = "none";

  // "clear" swatch
  const clearSwatch = document.createElement("button");
  clearSwatch.className = "node-color-swatch node-color-clear";
  clearSwatch.title = "Remove highlight";
  clearSwatch.textContent = "✕";
  colorPalette.appendChild(clearSwatch);

  for (const { name, value } of CONFIG.HIGHLIGHT_COLORS) {
    const swatch = document.createElement("button");
    swatch.className = "node-color-swatch";
    swatch.style.background = value;
    swatch.title = name;
    if (existingColor === value) swatch.classList.add("active");
    swatch.addEventListener("click", (e) => {
      e.stopPropagation();
      nodeColors.set(node.id, value);
      saveColors();
      row.style.setProperty("--node-highlight", value + "22");
      row.style.setProperty("--node-highlight-border", value);
      row.classList.add("node-highlighted");
      colorPalette
        .querySelectorAll(".node-color-swatch")
        .forEach((s) => s.classList.remove("active"));
      swatch.classList.add("active");
      // If children highlight is active, keep it in sync with the new color
      if (
        (node.type === "folder" || node.type === "json") &&
        nodeFolderColors.has(node.id)
      ) {
        nodeFolderColors.set(node.id, value);
        saveFolderColors();
        applyFolderColor(childrenWrap, value);
      }
      colorPalette.style.display = "none";
      colorBtn.style.display = "";
      // Reveal legend button now that a color is active
      legendBtn.classList.remove("node-legend-btn--hidden");
      renderLiveLegend();
    });
    colorPalette.appendChild(swatch);
  }

  // --- "Highlight whole children" toggle (folders and json parent nodes) ---
  if (node.type === "folder" || (node.type === "json" && node.hasChildren)) {
    const divider = document.createElement("span");
    divider.className = "node-color-divider";
    colorPalette.appendChild(divider);

    const folderToggle = document.createElement("button");
    folderToggle.className = "node-folder-highlight-toggle";
    const existingFolderColor = nodeFolderColors.get(node.id);
    folderToggle.textContent = existingFolderColor ? "📂✓" : "📂";
    folderToggle.title = existingFolderColor
      ? "Remove folder highlight"
      : "Highlight entire folder contents";
    colorPalette.appendChild(folderToggle);

    folderToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const activeColor = nodeColors.get(node.id);
      const alreadySet = nodeFolderColors.has(node.id);
      if (alreadySet) {
        nodeFolderColors.delete(node.id);
        saveFolderColors();
        applyFolderColor(childrenWrap, null);
        folderToggle.textContent = "📂";
        folderToggle.title = "Highlight entire folder contents";
      } else {
        const colorToUse = activeColor || CONFIG.HIGHLIGHT_COLORS[0].value;
        nodeFolderColors.set(node.id, colorToUse);
        saveFolderColors();
        applyFolderColor(childrenWrap, colorToUse);
        folderToggle.textContent = "📂✓";
        folderToggle.title = "Remove folder highlight";
      }
      colorPalette.style.display = "none";
      colorBtn.style.display = "";
    });
  }

  clearSwatch.addEventListener("click", (e) => {
    e.stopPropagation();
    nodeColors.delete(node.id);
    saveColors();
    row.style.removeProperty("--node-highlight");
    row.style.removeProperty("--node-highlight-border");
    row.classList.remove("node-highlighted");
    colorPalette
      .querySelectorAll(".node-color-swatch")
      .forEach((s) => s.classList.remove("active"));
    colorPalette.style.display = "none";
    colorBtn.style.display = "";
    legendBtn.classList.add("node-legend-btn--hidden");
    legendEditor.style.display = "none";
    renderLiveLegend();
  });

  colorBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = colorPalette.style.display !== "none";
    colorPalette.style.display = isOpen ? "none" : "";
  });

  colorPalette.addEventListener("click", (e) => e.stopPropagation());

  // --- Legend button: appears on hover after 🎨, only when node has a color ---
  const legendBtn = document.createElement("button");
  legendBtn.className = "node-legend-btn";
  if (!existingColor) legendBtn.classList.add("node-legend-btn--hidden");
  legendBtn.title = "Set legend label for this color";
  legendBtn.textContent = "📋";
  legendBtn.setAttribute("aria-label", "Edit legend label");

  // --- Legend inline editor (shown when legendBtn clicked) ---
  const legendEditor = document.createElement("span");
  legendEditor.className = "node-legend-editor";
  legendEditor.style.display = "none";

  const legendInput = document.createElement("input");
  legendInput.type = "text";
  legendInput.className = "node-legend-input";
  legendInput.placeholder = "Legend label for this color…";
  legendInput.maxLength = 60;

  const legendSaveBtn = document.createElement("button");
  legendSaveBtn.className = "node-legend-save";
  legendSaveBtn.textContent = "✓";
  legendSaveBtn.title = "Save legend label";

  const legendClearBtn = document.createElement("button");
  legendClearBtn.className = "node-legend-clear";
  legendClearBtn.textContent = "✕";
  legendClearBtn.title = "Remove legend label";

  legendEditor.appendChild(legendInput);
  legendEditor.appendChild(legendSaveBtn);
  legendEditor.appendChild(legendClearBtn);

  legendBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = legendEditor.style.display !== "none";
    if (isOpen) {
      closeLegendEditor();
      return;
    }
    const activeColor = nodeColors.get(node.id);
    if (!activeColor) return;
    legendInput.value = colorLegend.get(activeColor) || "";
    legendInput.dataset.color = activeColor;
    legendEditor.style.display = "";
    legendInput.focus();
    legendInput.select();
  });

  function closeLegendEditor() {
    legendEditor.style.display = "none";
    legendInput.classList.remove("node-legend-input--error");
    legendInput.title = "";
    legendInput.dataset.color = "";
  }

  legendSaveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const color = legendInput.dataset.color;
    const val = legendInput.value.trim();
    if (!color) return;
    if (val) {
      // Check if this label is already used by a *different* color
      const takenBy = [...colorLegend.entries()].find(
        ([existingColor, existingLabel]) =>
          existingLabel.toLowerCase() === val.toLowerCase() &&
          existingColor !== color,
      );
      if (takenBy) {
        legendInput.classList.add("node-legend-input--error");
        legendInput.title = `"${val}" is already used for another color`;
        legendInput.focus();
        return;
      }
      legendInput.classList.remove("node-legend-input--error");
      legendInput.title = "";
      colorLegend.set(color, val);
    } else {
      colorLegend.delete(color);
    }
    saveLegend();
    renderLiveLegend();
    closeLegendEditor();
  });

  legendClearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const color = legendInput.dataset.color;
    if (color) {
      colorLegend.delete(color);
      saveLegend();
      renderLiveLegend();
    }
    closeLegendEditor();
  });

  legendInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") legendSaveBtn.click();
    if (e.key === "Escape") {
      e.stopPropagation();
      closeLegendEditor();
    }
  });

  legendInput.addEventListener("input", () => {
    legendInput.classList.remove("node-legend-input--error");
    legendInput.title = "";
  });

  legendEditor.addEventListener("click", (e) => e.stopPropagation());

  row.appendChild(twisty);
  row.appendChild(icon);
  row.appendChild(label);
  row.appendChild(commentAnnotation);
  row.appendChild(commentBtn);
  row.appendChild(commentEditor);
  row.appendChild(colorBtn);
  row.appendChild(colorPalette);
  row.appendChild(legendBtn);
  row.appendChild(legendEditor);

  const childrenWrap = document.createElement("div");
  childrenWrap.className = "children";

  // Apply persisted folder-wide highlight
  const existingFolderColor = nodeFolderColors.get(node.id);
  if (existingFolderColor) applyFolderColor(childrenWrap, existingFolderColor);

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

  renderLiveLegend();
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
// Expand / Collapse All
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
