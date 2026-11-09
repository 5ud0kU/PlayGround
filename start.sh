#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
DEPLOYMENT_DIR="/home/runner/work/_temp/omgithub-web"

run_timed() {
  printf '[timing]'
  printf ' %q' "$@"
  printf '\n'
  /usr/bin/time -p "$@"
}

run_timed npm ci --no-audit --no-fund
run_timed npm run build
mkdir -p "$DEPLOYMENT_DIR"
node - "$PROJECT_DIR" "$PROJECT_DIR/dist" "$DEPLOYMENT_DIR/deployment-output.json" <<'NODE'
const fs = require('node:fs')
const [project, directory, output] = process.argv.slice(2)
fs.writeFileSync(output, JSON.stringify({ project, directory }, null, 2) + '\n')
NODE
printf 'Serving %s on port %s (foreground)\n' "$PROJECT_DIR/dist" "$PORT"
run_timed npm run preview -- --host 0.0.0.0 --port "$PORT" --strictPort
