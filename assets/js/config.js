const CONFIG = {
  ICON_SIZE: 16,
  ICON_CACHE_MAX: 200,
  ICON_CACHE_KEY: "sv_icon_cache_v1",
  THEME_KEY: "sv_theme",
  ADVANCED_ICONS_KEY: "sv_adv_icons",
  COMMENTS_KEY: "sv_comments_v1",
  COLORS_KEY: "sv_colors_v1",
  FOLDER_COLORS_KEY: "sv_folder_colors_v1",
  LEGEND_KEY: "sv_legend_v1",
  EXPORT_EXCLUDED_KEY: "sv_export_excluded_v1",
  HIGHLIGHT_COLORS: [
    { name: "red", value: "#ff6b6b" },
    { name: "orange", value: "#ffa94d" },
    { name: "yellow", value: "#ffe066" },
    { name: "green", value: "#69db7c" },
    { name: "blue", value: "#74c0fc" },
    { name: "purple", value: "#da77f2" },
  ],
  EXPORT_MAX_WIDTH: 6000,
  EXPORT_PADDING: 12,
  ICON_LOAD_TIMEOUT: 2500,
  ICON_CANVAS_SIZE: 32,
};

const EMOJI = {
  LOADING: "⏳",
  ERROR: "!",
  WARNING: "⚠️",
  FOLDER: "📁",
  FILE: "📄",
  JSON: "🔹",
};

const TWISTY = {
  COLLAPSED: "▶",
  EXPANDED: "▼",
  LEAF: "•",
};

const PRIORITY_FIELDS = ["name", "username", "title", "label", "id"];

const VSCODE_ICONS_BASE =
  "https://raw.githubusercontent.com/vscode-icons/vscode-icons/master/icons/";

const KEY_FALLBACKS = {
  javascript: ["js", "nodejs", "node"],
  typescript: ["ts"],
  reactjs: ["react"],
  reactts: ["react"],
  markdown: ["md"],
  csharp: ["cs"],
  yaml: ["yml"],
  shell: ["sh"],
  powershell: ["ps"],
  powerpoint: ["ppt"],
  excel: ["xls"],
  word: ["doc"],
};

const COMPOUND_EXTENSIONS = [
  "csproj.user",
  "vbproj.user",
  "tar.gz",
  "tar.bz2",
  "env.example",
];
