#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
PORT="${PORT:-3000}"
export PORT

/usr/bin/time -p test -f package.json
/usr/bin/time -p test -f package-lock.json
/usr/bin/time -p npm ci --prefer-offline
/usr/bin/time -p npm run build
/usr/bin/time -p test -f "$PROJECT_DIR/dist/index.html"

metadata_dir="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/home/runner/work/_temp}/omgithub-web}"
/usr/bin/time -p mkdir -p "$metadata_dir"
/usr/bin/time -p node -e 'const fs=require("node:fs"); const path=require("node:path"); const project=process.argv[1]; const file=process.argv[2]; fs.writeFileSync(file, JSON.stringify({project,directory:path.join(project,"dist")}));' "$PROJECT_DIR" "$metadata_dir/deployment-output.json"

exec /usr/bin/time -p node --input-type=module -e 'import { preview } from "vite"; await preview({ preview: { host: "0.0.0.0", port: Number(process.env.PORT), strictPort: true, allowedHosts: [".omgithub.com"] } });'
