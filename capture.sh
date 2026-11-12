#!/usr/bin/env bash
# Capture desktop and mobile screenshots of the deployed app.
# Accepts CAPTURE_URL and CAPTURE_DIR environment variables.
# Exits 75 for temporary navigation/browser infrastructure failures.
# Exits 1 for script or rendering defects.
set -euo pipefail

cd "$(dirname "$0")"

# ── Per-command timing helper ──────────────────────────────────────────
time_cmd() { /usr/bin/time -p "$@"; }

: "${CAPTURE_URL:?CAPTURE_URL environment variable is required}"
: "${CAPTURE_DIR:?CAPTURE_DIR environment variable is required}"

# All game UI is absolutely positioned, so <body> collapses to height 0 and
# Playwright reports it as hidden. Wait on #canvas instead, which fills the
# viewport via position:absolute inset:0 and is always rendered.
export CAPTURE_READY_SELECTOR="${CAPTURE_READY_SELECTOR:-#canvas}"

time_cmd mkdir -p "$CAPTURE_DIR"

# Run the Playwright-based capture: opens the exact URL in Chromium,
# waits for rendered content, captures desktop (1440x900) and mobile (390x844)
# views as final-desktop.png and final-mobile.png in CAPTURE_DIR, then closes
# its own browser and leaves the app running.
time_cmd node "${RUNTIME_DIR:?}/scripts/default-capture.mjs"
