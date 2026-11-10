#!/usr/bin/env bash
# Start the Helix Forge preview server in the foreground.
# Writes worker metadata to OPENCODE_WEB_DIR, keeps source and built output
# inside PROJECT_DIR, and serves on PORT (default 3000).
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

: "${OPENCODE_WEB_DIR:=/home/runner/work/_temp/omgithub-web}"
PORT="${PORT:-3000}"
export PORT

mkdir -p "$OPENCODE_WEB_DIR"

run_timed() {
  printf '[timing]'
  printf ' %q' "$@"
  printf '\n'
  /usr/bin/time -p "$@"
}

run_timed npm ci --no-audit --no-fund
run_timed npm run build

# Write deployment metadata for the controller (worker metadata only).
node - "$PROJECT_DIR" "$OPENCODE_WEB_DIR" <<'NODE'
const fs = require('node:fs')
const [project, webDir] = process.argv.slice(2)
fs.writeFileSync(
  `${webDir}/deployment-output.json`,
  JSON.stringify({ project, directory: `${project}/dist` }, null, 2) + '\n'
)
NODE

printf 'Serving %s on port %s (foreground)\n' "$PROJECT_DIR/dist" "$PORT"
run_timed npm run preview -- --host 0.0.0.0 --port "$PORT" --strictPort
