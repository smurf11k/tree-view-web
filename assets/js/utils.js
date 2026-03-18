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
