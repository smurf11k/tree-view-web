function applyTheme(mode) {
  // mode: "system" | "dark" | "light"
  if (mode === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
  }
  localStorage.setItem(CONFIG.THEME_KEY, mode);
  // renderLiveLegend is defined in legend.js which loads after theme.js
  if (typeof renderLiveLegend === "function") renderLiveLegend();
}

function getEffectiveTheme() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "dark" || explicit === "light") return explicit;
  // system
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function themeVars(theme) {
  if (theme === "light") {
    return {
      bg: "#f6f8fc",
      panel: "#ffffff",
      border: "#d7deea",
      text: "#0e1625",
      muted: "#52627a",
      btn: "#eef2fb",
      btnHover: "#e3e9f7",
    };
  }
  return {
    bg: "#0b0f17",
    panel: "#101827",
    border: "#1d2a44",
    text: "#e6edf7",
    muted: "#9fb0c8",
    btn: "#1b2a46",
    btnHover: "#24365a",
  };
}

function setThemeOnElement(el, theme) {
  el.style.setProperty("--bg", theme.bg);
  el.style.setProperty("--panel", theme.panel);
  el.style.setProperty("--border", theme.border);
  el.style.setProperty("--text", theme.text);
  el.style.setProperty("--muted", theme.muted);
  el.style.setProperty("--btn", theme.btn);
  el.style.setProperty("--btnHover", theme.btnHover);
}

(function initTheme() {
  const saved = localStorage.getItem(CONFIG.THEME_KEY) || "system";
  if (themeSelect) themeSelect.value = saved;
  applyTheme(saved);

  themeSelect?.addEventListener("change", (e) => {
    applyTheme(e.target.value);
  });

  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener?.("change", () => {
      const cur = localStorage.getItem(CONFIG.THEME_KEY) || "system";
      if (cur === "system") applyTheme("system");
    });
  }

  // Build custom styled dropdown to replace native <select>
  if (!themeSelect) return;

  const OPTIONS = [
    { value: "system", label: "System" },
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
  ];

  // Hide native select but keep it in DOM for value tracking
  themeSelect.style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.className = "theme-select-wrap";

  const trigger = document.createElement("button");
  trigger.className = "theme-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const triggerLabel = document.createElement("span");
  const triggerArrow = document.createElement("span");
  triggerArrow.className = "theme-select-arrow";
  triggerArrow.innerHTML = '<i class="bi bi-chevron-down"></i>';
  trigger.appendChild(triggerLabel);
  trigger.appendChild(triggerArrow);

  const panel = document.createElement("div");
  panel.className = "theme-select-panel";
  panel.setAttribute("role", "listbox");

  OPTIONS.forEach(({ value, label }) => {
    const opt = document.createElement("div");
    opt.className = "theme-select-option";
    opt.setAttribute("role", "option");
    opt.dataset.value = value;
    opt.textContent = label;
    opt.addEventListener("click", () => {
      themeSelect.value = value;
      themeSelect.dispatchEvent(new Event("change"));
      updateTrigger(value);
      closePanel();
    });
    panel.appendChild(opt);
  });

  function updateTrigger(value) {
    const opt = OPTIONS.find((o) => o.value === value);
    triggerLabel.textContent = opt ? opt.label : value;
    panel.querySelectorAll(".theme-select-option").forEach((el) => {
      el.classList.toggle("active", el.dataset.value === value);
    });
  }

  function openPanel() {
    panel.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
  }

  function closePanel() {
    panel.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.contains("open") ? closePanel() : openPanel();
  });

  document.addEventListener("click", closePanel);
  panel.addEventListener("click", (e) => e.stopPropagation());

  wrapper.appendChild(trigger);
  wrapper.appendChild(panel);
  themeSelect.parentNode.insertBefore(wrapper, themeSelect.nextSibling);

  updateTrigger(saved);
})();
