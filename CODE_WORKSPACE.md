# Code workspace architecture

The Code workspace is a small, browser-native project environment. It lets a player edit and run real HTML, CSS, and JavaScript while keeping project code separate from the desktop's privileged UI.

## Layers and ownership

- **Project model (`app.js`)** — `state.codeProject` stores the named source files and selected file. It is serialized with the rest of the desktop state under `solace-desktop-v1` in local storage. Starter files are merged in when loading older or incomplete saves.
- **Editor and controller (`codeHTML` / `bindApp('code')`)** — file selection, autosave, reset, keyboard shortcut, and preview actions. The editor is a plain textarea, so it remains dependency-free and edits actual source rather than a visual approximation.
- **Preview runtime (`previewDocument`)** — each run snapshots the project and builds a `srcdoc` document. HTML and CSS are applied in the iframe; the JavaScript file runs as JavaScript and receives only the `solace` bridge object.
- **Desktop bridge (`message` handler)** — the preview sends requests with `postMessage`. The host accepts messages only from the current Code window's iframe and validates each action against an explicit allowlist before changing desktop state.

## Isolation and extension rules

The preview iframe uses `sandbox="allow-scripts"` without `allow-same-origin`, so its document has an opaque origin and cannot directly access the desktop DOM or local storage. Its Content Security Policy denies network connections, forms, external resources, and base-URL changes; inline scripts and styles are enabled because the project is assembled locally. The parent does not expose a general-purpose host object—only these actions are currently supported:

- `solace.notify(message)`
- `solace.setWallpaper(name)` for the four built-in wallpaper presets
- `solace.openApp(name)` for approved desktop apps

When adding a bridge action, add a narrowly scoped preview method, validate the message type and payload in the host, and keep the allowed values explicit. Do not pass DOM nodes, state objects, arbitrary selectors, URLs, or generic host callbacks across the boundary.

## Current scope and tradeoffs

This is one local project with three files, stored in the browser; it has no filesystem access, package manager, network access, build pipeline, or multi-project management. The preview is suitable for experiments and desktop customization through the listed bridge actions, not for modifying the desktop's source files or executing operating-system commands. The browser sandbox restricts capabilities, but does not impose CPU or memory quotas; avoid running untrusted projects in a production environment without additional resource controls.
