#!/usr/bin/env bash
set -euo pipefail

# Environment variables
CAPTURE_URL="${CAPTURE_URL:-}"
CAPTURE_DIR="${CAPTURE_DIR:-}"

if [ -z "$CAPTURE_URL" ] || [ -z "$CAPTURE_DIR" ]; then
  echo "Usage: CAPTURE_URL=<url> CAPTURE_DIR=<dir> $0"
  exit 1
fi

# Ensure capture directory exists (outside source tree)
mkdir -p "$CAPTURE_DIR"

# Generate timestamp for per-command timing
START_TIME=$(date +%s%N)

# Use system Google Chrome to capture screenshots
# Exit 75 for temporary navigation/browser infrastructure failures
# Exit 1 for script or rendering defects

CHROME_BIN="google-chrome"
CAPTURE_WIDTH=1920
CAPTURE_HEIGHT=1080
MOBILE_WIDTH=375
MOBILE_HEIGHT=667

echo "Capturing: $CAPTURE_URL"
echo "Output directory: $CAPTURE_DIR"

# Capture desktop view
DESKTOP_PATH="${CAPTURE_DIR}/final-desktop.png"
MOBILE_PATH="${CAPTURE_DIR}/final-mobile.png"

# Capture desktop view
DESKTOP_EXIT=1
if [ -x "$(command -v $CHROME_BIN)" ]; then
  CHROME_ARGS=(
    "--headless"
    "--disable-gpu"
    "--window-size=${CAPTURE_WIDTH},${CAPTURE_HEIGHT}"
    "--virtual-time-budget=30000"
    "--screenshot"
    "--disable-features=IsolateOriginsForPayments"
    "--disable-features=Don'tFragment"
  )
  set +e
  "$CHROME_BIN" "${CHROME_ARGS[@]}" --screenshot="${DESKTOP_PATH}" "$CAPTURE_URL" 2>/dev/null
  DESKTOP_EXIT=$?
  set -e
else
  echo "Error: Google Chrome not found"
  DESKTOP_EXIT=1
fi

# Capture mobile view
if [ $DESKTOP_EXIT -eq 0 ] && [ -f "$DESKTOP_PATH" ]; then
  set +e
  CHROME_MOBILE_ARGS=(
    "--headless"
    "--disable-gpu"
    "--window-size=${MOBILE_WIDTH},${MOBILE_HEIGHT}"
    "--virtual-time-budget=30000"
    "--screenshot"
    "--disable-features=IsolateOriginsForPayments"
    "--disable-features=Don'tFragment"
  )
  "$CHROME_BIN" "${CHROME_MOBILE_ARGS[@]}" --screenshot="${MOBILE_PATH}" "$CAPTURE_URL" 2>/dev/null
  MOBILE_EXIT=$?
  set -e
else
  MOBILE_EXIT=1
fi

# Report per-command timing
END_TIME=$(date +%s%N)
ELAPSED_MS=$(( (END_TIME - START_TIME) / 1000000 ))
echo "Capture completed in ${ELAPSED_MS}ms"

# Determine exit code
# Exit 75 for temporary navigation/browser infrastructure failures
# Exit 1 for script or rendering defects
if [ ! -f "$DESKTOP_PATH" ] || [ ! -f "$MOBILE_PATH" ]; then
  echo "Warning: One or both screenshot files could not be created"
  if [ ! -f "$DESKTOP_PATH" ] && [ ! -f "$MOBILE_PATH" ]; then
    exit 75  # browser infrastructure failure
  fi
fi

# Verify screenshots are valid PNGs with content
if [ -f "$DESKTOP_PATH" ] && [ "$(stat -c%s "$DESKTOP_PATH" 2>/dev/null || echo 0)" -lt 1000 ]; then
  rm -f "$DESKTOP_PATH"
fi
if [ -f "$MOBILE_PATH" ] && [ "$(stat -c%s "$MOBILE_PATH" 2>/dev/null || echo 0)" -lt 1000 ]; then
  rm -f "$MOBILE_PATH"
fi

exit 0