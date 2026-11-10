#!/usr/bin/env bash
# Capture desktop and mobile screenshots of the running preview.
# Requires CAPTURE_URL and CAPTURE_DIR. Keeps output outside source and leaves
# the app running. Exits 75 for temporary browser/navigation infra failures,
# 1 for script or rendering defects.
set -euo pipefail

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR for screenshot output}"
mkdir -p "$CAPTURE_DIR"

run_timed() {
  printf '[timing]'
  printf ' %q' "$@"
  printf '\n'
  /usr/bin/time -p "$@"
}

CAPTURE_WORK="$(mktemp -d)"
export CAPTURE_WORK
trap 'rm -rf "$CAPTURE_WORK"' EXIT

# playwright-core is small; install to a throwaway dir and use system chromium.
run_timed npm install --prefix "$CAPTURE_WORK" --no-audit --no-fund playwright-core@1.65.0

run_timed node --input-type=module <<'NODE'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const require = createRequire(join(process.env.CAPTURE_WORK, 'package.json'))
const { chromium } = require('playwright-core')

const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
const executablePath = '/usr/bin/chromium'

let browser
let exitCode = 0
try {
  browser = await chromium.launch({
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    timeout: 30000,
  }).catch((error) => {
    throw Object.assign(error, { exitCode: 75 })
  })

  for (const [name, width, height] of [
    ['desktop', 1280, 900],
    ['mobile', 390, 844],
  ]) {
    const page = await browser.newPage({ viewport: { width, height } }).catch((error) => {
      throw Object.assign(error, { exitCode: 75 })
    })
    page.setDefaultTimeout(30000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 400 && new URL(response.url()).origin === new URL(url).origin) {
        errors.push(`HTTP ${response.status()}: ${response.url()}`)
      }
    })
    const response = await page.goto(url, { waitUntil: 'load', timeout: 45000 }).catch((error) => {
      throw Object.assign(error, {
        exitCode: !response || [408, 429, 500, 502, 503, 504].includes(response.status) ? 75 : 1,
      })
    })
    if (!response?.ok()) {
      throw Object.assign(
        new Error(`HTTP ${response?.status()} loading preview`),
        {
          exitCode: !response || [408, 429, 500, 502, 503, 504].includes(response.status) ? 75 : 1,
        }
      )
    }
    await page.locator('#app .shell').waitFor({ state: 'visible', timeout: 30000 })
    await page.locator('.stage-head h1').waitFor({ state: 'visible', timeout: 30000 })
    await page.waitForFunction(() => document.fonts.status === 'loaded', null, { timeout: 30000 })
    await page.waitForTimeout(1200)
    if (errors.length) {
      throw new Error(`Page rendering failed: ${errors.join('; ')}`)
    }
    await page
      .screenshot({ path: join(output, `final-${name}.jpg`), type: 'jpeg', quality: 86, fullPage: false, timeout: 30000 })
      .catch((error) => {
        throw error
      })
    console.log(`Captured ${name} at ${url}`)
    await page.close()
  }
} catch (error) {
  console.error(error)
  exitCode = error.exitCode || 1
} finally {
  await browser?.close().catch(() => {})
  process.exitCode = exitCode
}
NODE
