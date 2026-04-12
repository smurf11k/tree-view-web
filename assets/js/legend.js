// Builds and returns a legend DOM element styled with themeVars tv
function buildLegendElement(tv, usedColors = getUsedColors()) {
  // Only include entries for colors that are actually used in the tree
  const entries = CONFIG.HIGHLIGHT_COLORS.filter(
    ({ value }) => usedColors.has(value) && colorLegend.has(value),
  );
  if (entries.length === 0) return null;

  const wrap = document.createElement("div");
  wrap.className = "legend-wrap";
  wrap.style.marginTop = "16px";
  wrap.style.padding = "10px 14px";
  wrap.style.border = `1px solid ${tv.border}`;
  wrap.style.borderRadius = "6px";
  wrap.style.background = tv.panel;
  wrap.style.color = tv.text;
  wrap.style.fontFamily = "inherit";
  wrap.style.fontSize = "13px";

  const title = document.createElement("div");
  title.textContent = "Legend";
  title.style.fontWeight = "600";
  title.style.marginBottom = "8px";
  title.style.color = tv.muted;
  title.style.textTransform = "uppercase";
  title.style.fontSize = "11px";
  title.style.letterSpacing = "0.05em";
  wrap.appendChild(title);

  const grid = document.createElement("div");
  grid.style.display = "flex";
  grid.style.flexWrap = "wrap";
  grid.style.gap = "8px 18px";
  wrap.appendChild(grid);

  for (const { value } of entries) {
    const label = colorLegend.get(value);
    const item = document.createElement("div");
    item.style.display = "flex";
    item.style.alignItems = "center";
    item.style.gap = "7px";

    const swatch = document.createElement("span");
    swatch.style.display = "inline-block";
    swatch.style.width = "12px";
    swatch.style.height = "12px";
    swatch.style.borderRadius = "50%";
    swatch.style.background = value;
    swatch.style.flexShrink = "0";

    const text = document.createElement("span");
    text.textContent = label;
    text.style.color = tv.text;

    item.appendChild(swatch);
    item.appendChild(text);
    grid.appendChild(item);
  }

  return wrap;
}

// Re-renders the live legend panel in the UI.
// The #legendWrap container is created dynamically on first use
// and injected after #treeWrap inside the same panel.
function renderLiveLegend() {
  let container = document.getElementById("legendWrap");

  if (!container) {
    const treeWrap = document.getElementById("treeWrap");
    if (!treeWrap) return;
    container = document.createElement("div");
    container.id = "legendWrap";
    container.style.padding = "0 12px 12px";
    treeWrap.parentNode.insertBefore(container, treeWrap.nextSibling);
  }

  container.innerHTML = "";
  // Don't show legend when no tree is loaded
  if (!currentRoot) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }
  const effectiveTheme = getEffectiveTheme();
  const tv = themeVars(effectiveTheme);
  const el = buildLegendElement(tv);
  if (el) {
    container.appendChild(el);
    container.style.display = "";
  } else {
    container.style.display = "none";
  }
}
