# Structure Viewer

A lightweight, browser-based tool for visualizing **folder structures** and **JSON data** as an interactive tree — with optional advanced file-type icons and PNG export.

Built to be fast, privacy-friendly, and dependency-light.  
Runs entirely in the browser. No uploads. No servers.

---

## ✨ Features

### 📁 Folder Tree Viewer

- Pick a local folder using the **File System Access API**
- Lazy-loads subfolders for performance
- Expand / collapse individual nodes or the entire tree
- Alphabetical ordering (folders first)

> Requires Chromium-based browsers (Chrome, Edge)

---

### 🧾 JSON Tree Viewer

- Load any `.json` file locally
- Smart labeling for array items using priority fields:
  - `name`, `username`, `title`, `id`
- Clean, readable tree structure
- Handles deeply nested data safely

---

### 🎨 Themes

- **System**, **Dark**, and **Light** themes
- Theme-aware PNG export
- Theme preference stored locally

---

### 🖼️ PNG Export

- **Export View** – exports exactly what’s expanded
- **Export Full** – auto-expands everything before export
- Optional background (transparent or theme-colored)
- Export width auto-fits to content
- Icons are rasterized safely for reliable exports

---

### 🧠 Advanced File Icons (Optional)

- Toggleable “Advanced Icons” mode
- Loads official file-type icons (based on VS Code icon set)
- Supports many formats:
  - Code: `.js`, `.ts`, `.cs`, `.java`, `.py`, `.cpp`, …
  - Media: `.mp3`, `.mp4`, `.png`, `.svg`, …
  - Docs: `.pdf`, `.docx`, `.pptx`, `.xlsx`, …
  - Archives, fonts, binaries, configs, and more
- Icons are cached locally for performance
- Falls back gracefully to emojis if unavailable

---

## 🔐 Privacy & Security

- **Nothing is uploaded**
- Files and folders are accessed only via browser APIs
- No data leaves your machine
- No analytics, tracking, or background requests (except optional icon fetching)

This tool is safe to use with sensitive local data.

---

## 🌐 Browser Support

| Feature        | Support             |
| -------------- | ------------------- |
| Folder picker  | Chrome, Edge        |
| JSON viewer    | All modern browsers |
| PNG export     | All modern browsers |
| Advanced icons | All modern browsers |

---

## 🚀 Usage

### Online (GitHub Pages)

1. Open the hosted page
2. Click **Pick Folder** or **Pick JSON**
3. Explore the tree
4. Export if needed

### Local

```bash
git clone <repo-url>
cd structure-viewer
open index.html
```

No build step required.

## 🛠️ Tech Stack

- Vanilla HTML / CSS / JavaScript
- html2canvas for PNG export
- File System Access API (Chromium)
- Zero frameworks

Designed to run well even on older or low-powered machines.

## 📄 License

**Custom License – Personal & Educational Use Only**

**Copyright © 2026**

Permission is granted to use this software for:

- Personal projects
- Educational purposes
- Learning, experimentation, and reference

The following are **not permitted** without explicit written permission from the author:

- Redistribution (free or paid)
- Commercial use
- Repackaging or reselling
- Hosting modified or unmodified versions as a public service
- Including this project in other distributed software

This software is provided **“as is”**, without warranty of any kind.

If you want to use this project beyond personal or educational purposes, please contact the author.

## ⭐ Notes

This project was built with a strong focus on:

- Simplicity
- Performance
- Correct exports
- Predictable behavior

If something looks boring in the code — it’s probably intentional 🙂

## ❤️ Acknowledgements

- File-type icons inspired by the VS Code icon ecosystem
- Thanks to browser vendors for finally making local file access usable

---

Enjoy exploring your data 🌲
