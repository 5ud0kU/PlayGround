#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/runner/work/PlayGround/PlayGround"
DIST_DIR="${PROJECT_DIR}/dist"
DEPLOY_OUTPUT="${PROJECT_DIR}/deployment-output.json"
PORT="${PORT:-3000}"

# Write deployment output metadata
mkdir -p "$(dirname "$DEPLOY_OUTPUT")"
writeDeploymentOutput() {
  cat > "$DEPLOY_OUTPUT" << DEPLOY_EOF
{"project":"${PROJECT_DIR}","directory":"${DIST_DIR}"}
DEPLOY_EOF
}

# Ensure dist directory exists for built output
mkdir -p "$DIST_DIR"

# Write deployment output once per start
writeDeploymentOutput

# Change to project directory
cd "$PROJECT_DIR"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install 2>&1
fi

# Build if package.json has a build script
if [ -f "package.json" ] && grep -q '"build"' package.json; then
  echo "Building project..."
  npm run build 2>&1
fi

# Serve the project in the foreground
# If dist/index.html exists, serve from dist; otherwise serve project root
if [ -f "$DIST_DIR/index.html" ]; then
  echo "Serving from dist/ on port $PORT"
  npx serve -s "$DIST_DIR" -l "$PORT" &
else
  echo "Serving from project root on port $PORT"
  npx serve -s "." -l "$PORT" &
fi

# Wait for the server to be ready
sleep 2

# Get the PID of the background serve process
SERVE_PID=$!

# Keep the script running foreground - forward signals to the serve process
trap "kill $SERVE_PID 2>/dev/null; exit 0" SIGTERM SIGINT

echo "Reality Unbound running on http://localhost:$PORT"
wait $SERVE_PID