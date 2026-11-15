#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to the evidence directory}"

CAPTURE_DIR="$(/usr/bin/time -p realpath -m "$CAPTURE_DIR")"
case "$CAPTURE_DIR" in
  "$PROJECT_DIR"|"$PROJECT_DIR"/*)
    echo 'CAPTURE_DIR must be outside the source project.' >&2
    exit 1
    ;;
esac
CAPTURE_SCRIPT="${RUNTIME_DIR:-$PROJECT_DIR/.omgithub}/scripts/default-capture.mjs"
if [[ ! -f "$CAPTURE_SCRIPT" ]]; then
  echo "Capture runtime script not found: $CAPTURE_SCRIPT" >&2
  exit 1
fi
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"
/usr/bin/time -p env CAPTURE_URL="$CAPTURE_URL" CAPTURE_DIR="$CAPTURE_DIR" CAPTURE_STRICT=1 node "$CAPTURE_SCRIPT"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-desktop.png"
/usr/bin/time -p test -s "$CAPTURE_DIR/final-mobile.png"
