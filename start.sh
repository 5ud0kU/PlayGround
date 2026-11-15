#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
OPENCODE_WEB_DIR="${OPENCODE_WEB_DIR:-/home/runner/work/_temp/omgithub-web}"

/usr/bin/time -p mkdir -p "$OPENCODE_WEB_DIR"

if [[ -f "$PROJECT_DIR/package.json" ]]; then
  if [[ -f "$PROJECT_DIR/package-lock.json" ]]; then
    /usr/bin/time -p npm ci --no-audit --no-fund
  else
    /usr/bin/time -p npm install --no-audit --no-fund
  fi
  if /usr/bin/time -p node -e 'const p=require(process.argv[1]); process.exit(p.scripts?.build ? 0 : 1)' "$PROJECT_DIR/package.json"; then
    /usr/bin/time -p npm run build
  fi
  if [[ -f "$PROJECT_DIR/dist/index.html" ]]; then
    STATIC_DIR="$PROJECT_DIR/dist"
  elif [[ -f "$PROJECT_DIR/build/index.html" ]]; then
    STATIC_DIR="$PROJECT_DIR/build"
  else
    echo 'Build output must be dist/index.html or build/index.html.' >&2
    exit 1
  fi
else
  STATIC_DIR="$PROJECT_DIR/dist"
  /usr/bin/time -p mkdir -p "$STATIC_DIR"
  /usr/bin/time -p cp "$PROJECT_DIR/index.html" "$PROJECT_DIR/app.js" "$PROJECT_DIR/styles.css" "$STATIC_DIR/"
fi

/usr/bin/time -p node -e 'const fs=require("node:fs"); const path=require("node:path"); const project=path.resolve(process.argv[1]); const directory=path.resolve(process.argv[2]); if (!directory.startsWith(project + path.sep) || !fs.existsSync(path.join(directory,"index.html"))) throw new Error("Static directory must be inside the project and contain index.html"); fs.writeFileSync(path.join(process.env.OPENCODE_WEB_DIR,"deployment-output.json"), JSON.stringify({project,directory})+"\n")' "$PROJECT_DIR" "$STATIC_DIR"
echo "Serving Solace desktop on http://localhost:${PORT} from ${STATIC_DIR}"
exec /usr/bin/time -p python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$STATIC_DIR"
