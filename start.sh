#!/usr/bin/env bash
# Start the Polygon game static server.
# Writes deployment-output metadata, installs deps when present, builds when needed,
# and serves the built static directory in the foreground on PORT (default 3000).
set -euo pipefail

cd "$(dirname "$0")"
PROJECT_DIR="$(pwd)"

# ── Per-command timing helper ──────────────────────────────────────────
time_cmd() { /usr/bin/time -p "$@"; }

# ── Write deployment-output metadata ───────────────────────────────────
WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"
mkdir -p "$WEB_DIR"
time_cmd /usr/bin/printf '%s' "{\"project\":\"${PROJECT_DIR}\",\"directory\":\"${PROJECT_DIR}\"}" > "$WEB_DIR/deployment-output.json"
cat "$WEB_DIR/deployment-output.json"

# ── Install dependencies (only if a package.json exists) ───────────────
if time_cmd test -f package.json; then
  if time_cmd test -f package-lock.json; then
    time_cmd npm ci --no-audit --no-fund
  else
    time_cmd npm install --no-audit --no-fund
  fi
fi

# ── Build when needed ──────────────────────────────────────────────────
# This is a static HTML project: index.html is the built entry point.
# No build step is required; the built static directory is the project root.

# ── Serve in the foreground on PORT (default 3000) ─────────────────────
PORT="${PORT:-3000}"
export PORT

/usr/bin/time -p node -e '
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = process.cwd();
const mime = {
  ".html": "text/html", ".js": "application/javascript",
  ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".wasm": "application/wasm",
  ".glb": "model/gltf-binary", ".ico": "image/x-icon"
};
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let filePath = path.join(root, "." + decodeURIComponent(url.pathname));
    if (filePath === root) filePath = path.join(root, "index.html");
    else if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
    const ext = path.extname(filePath).toLowerCase();
    res.setHeader("Content-Type", mime[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.end(fs.readFileSync(filePath));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(Number(process.env.PORT || 3000), "0.0.0.0");
'
