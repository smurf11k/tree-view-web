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

function getFileExtension(filename) {
  if (!filename) return "";
  const base = filename.split("/").pop().toLowerCase();

  // Compound
  for (const ext of COMPOUND_EXTENSIONS) {
    if (base.endsWith("." + ext) || base === ext) return ext;
  }

  // Special - direct lookup
  const specialMap = window.SPECIAL_FILENAMES || {};
  if (specialMap[base]) return specialMap[base];

  // Standard extension
  const dotIndex = base.lastIndexOf(".");
  if (dotIndex > 0) return base.slice(dotIndex + 1);
  return base;
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
