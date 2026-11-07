#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAPTURE_URL="${CAPTURE_URL:?Set CAPTURE_URL to the exact preview URL}"
CAPTURE_DIR="${CAPTURE_DIR:?Set CAPTURE_DIR to an output directory}"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

/usr/bin/time -p node --input-type=module <<'NODE'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const runtime = join(process.env.HOME, '.local/share/omgithub-playwright')
const require = createRequire(join(runtime, 'package.json'))
const { chromium } = require('playwright')
const config = require(join(runtime, 'linux.json'))
if (process.platform === 'linux') {
  const { readFileSync } = await import('node:fs')
  process.env.DISPLAY ||= ':' + readFileSync(join(runtime, 'display'), 'utf8').trim()
}
const url = process.env.CAPTURE_URL
const output = process.env.CAPTURE_DIR
try {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('CAPTURE_URL must use HTTP or HTTPS.')
} catch (error) {
  console.error(error)
  process.exit(1)
}
mkdirSync(output, { recursive: true })
const timed = async (label, fn) => {
  const start = Date.now()
  try { return await fn() }
  finally { console.log(`[timing] ${label}: ${Date.now() - start} ms`) }
}
const fail = (error, code) => { error.exitCode = code; throw error }
let browser
let exitCode = 0
try {
  browser = await timed('Playwright browser launch', () => chromium.launch({ ...config.browser.launchOptions, timeout: 30000 }).catch(error => fail(error, 75)))
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const page = await timed(`${name} page creation`, () => browser.newPage({ viewport: { width, height } }).catch(error => fail(error, 75)))
    page.setDefaultTimeout(30000)
    const pageErrors = []
    const badResponses = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).origin === new URL(url).origin) {
        badResponses.push(`HTTP ${response.status()}: ${response.url()}`)
      }
    })

    let response
    try {
      response = await timed(`${name} navigation`, () => page.goto(url, { waitUntil: 'load', timeout: 45000 }))
    } catch (error) {
      fail(error, 75)
    }
    if (!response) fail(new Error(`No HTTP response while loading ${url}`), 75)
    if (!response.ok()) {
      const status = response.status()
      fail(new Error(`HTTP ${status} loading preview`), [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1)
    }

    try {
      await timed(`${name} render readiness`, async () => {
        await page.locator('body').waitFor({ state: 'visible' })
        await page.locator('#scene').waitFor({ state: 'visible' })
        await page.waitForFunction(() => document.fonts.status === 'loaded')
        await page.waitForFunction(() => {
          const canvas = document.querySelector('#scene')
          return canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0 && document.body.innerText.trim().length > 0
        })
        await page.waitForTimeout(1000)
      })
    } catch (error) {
      fail(new Error(`The page did not render correctly: ${error.message}`), 1)
    }
    if (pageErrors.length) fail(new Error(`Application JavaScript error: ${pageErrors.join('; ')}`), 1)
    if (badResponses.length) fail(new Error(`Failed same-origin resources: ${badResponses.join('; ')}`), 1)

    await timed(`${name} screenshot`, () => page.screenshot({ path: join(output, `final-${name}.png`), fullPage: true, timeout: 30000 }).catch(error => fail(error, error.name === 'TimeoutError' || !browser.isConnected() ? 75 : 1)))
    await timed(`${name} page close`, () => page.close().catch(error => fail(error, 75)))
  }
} catch (error) {
  console.error(error)
  exitCode = error.exitCode || 1
} finally {
  if (browser) {
    try { await timed('Playwright browser close', () => browser.close()) }
    catch (error) { console.error(error); exitCode ||= 75 }
  }
}
process.exitCode = exitCode
NODE
