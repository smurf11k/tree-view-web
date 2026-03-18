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
