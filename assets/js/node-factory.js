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
