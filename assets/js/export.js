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

    // Strip all interactive UI chrome from the clone — buttons, open editors, palettes
    const exportStripSelectors = [
      ".node-comment-btn",
      ".node-comment-editor",
      ".node-color-btn",
      ".node-color-palette",
      ".node-legend-btn",
      ".node-legend-editor",
      ".node-export-btn",
    ];
    clone
      .querySelectorAll(exportStripSelectors.join(","))
      .forEach((el) => el.remove());

    clone
      .querySelectorAll('[data-export-excluded="true"]')
      .forEach((el) => el.remove());

    const exportedNodeIds = new Set(
      Array.from(clone.querySelectorAll("[data-node-id]"))
        .map((el) => el.getAttribute("data-node-id"))
        .filter(Boolean),
    );

    // Append legend if any entries exist
    const legendEl = buildLegendElement(
      tv,
      getUsedColorsForNodeIds(exportedNodeIds),
    );
    if (legendEl) cloneHost.appendChild(legendEl);

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
