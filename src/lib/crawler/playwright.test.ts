import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser } from 'playwright'
import { BrowserHandle, installEgressGuard, openBrowser } from './playwright'
import { colorAreasScript } from './page-scripts'
import { sanitizeColorAreas } from './sanitize'

/**
 * A3: a real Chromium with the egress guard installed. A local "internal"
 * server counts HTTP requests and TCP connections; hostile page content aims
 * fetch, XHR, iframes, scripts, stylesheets, preconnect, beacons and
 * WebSockets at it.
 *
 * - The route guard alone stops fetch, XHR, WebSocket, iframes, scripts
 *   and stylesheets. Chromium does NOT send <link rel=prefetch> or
 *   navigator.sendBeacon through Playwright routing, and preconnect opens a
 *   bare socket with no request at all; those are the known gaps.
 * - The production setup (route guard + dead proxy from openBrowser) closes
 *   them: not a single request or TCP connection may arrive.
 */

let handle: BrowserHandle | null = null
/** Plain Chromium without the dead proxy, to prove the route guard on its own. */
let plain: Browser | null = null
let internal: http.Server
let port = 0
let connections = 0
let leaked: string[] = []

beforeAll(async () => {
  internal = http.createServer((_req, res) => {
    leaked.push(_req.url ?? '')
    res.end('internal secret')
  })
  internal.on('connection', () => { connections++ })
  await new Promise<void>(resolve => internal.listen(0, '127.0.0.1', resolve))
  port = (internal.address() as AddressInfo).port
  handle = await openBrowser()
  plain = await chromium.launch({ headless: true }).catch(() => null)
}, 30_000)

afterAll(async () => {
  await handle?.close()
  await plain?.close()
  internal.closeAllConnections()
  internal.close()
})

describe('Playwright egress guard', () => {
  for (const mode of ['route guard alone', 'route guard + dead proxy']) it(`${mode} keeps page traffic away from an internal address`, async (ctx) => {
    const guardOnly = mode === 'route guard alone'
    const browser = guardOnly ? plain : handle?.browser
    if (!browser) ctx.skip()
    connections = 0
    leaked = []
    const context = await browser!.newContext({ serviceWorkers: 'block' })
    try {
      await installEgressGuard(context)
      const page = await context.newPage()
      const target = `http://127.0.0.1:${port}`
      await page.setContent(`<!doctype html><html><head>
        <link rel="preconnect" href="${target}">
        <link rel="dns-prefetch" href="${target}">
        <link rel="prefetch" href="${target}/prefetch">
        <link rel="stylesheet" href="${target}/style.css">
        <script src="${target}/script.js"></script>
        </head><body>
        <iframe src="${target}/frame"></iframe>
        <iframe src="http://169.254.169.254/latest/meta-data/"></iframe>
        <img src="${target}/img.png">
        </body></html>`)
      const outcomes = await page.evaluate(async (t) => {
        const results: string[] = []
        const attempt = async (name: string, fn: () => Promise<unknown>) => {
          try {
            await fn()
            results.push(`${name}:ok`)
          } catch {
            results.push(`${name}:blocked`)
          }
        }
        await attempt('fetch', () => fetch(t + '/fetch').then(r => r.text()))
        await attempt('fetch-localhost', () => fetch('http://localhost:' + t.split(':').pop() + '/x').then(r => r.text()))
        await attempt('xhr', () => new Promise((resolve, reject) => {
          const x = new XMLHttpRequest()
          x.open('GET', t + '/xhr')
          x.onload = resolve
          x.onerror = reject
          x.send()
        }))
        await attempt('ws', () => new Promise((resolve, reject) => {
          const ws = new WebSocket(t.replace('http', 'ws') + '/ws')
          ws.onopen = resolve
          ws.onerror = reject
          ws.onclose = reject
        }))
        navigator.sendBeacon(t + '/beacon', 'x')
        await new Promise(r => setTimeout(r, 500))
        return results
      }, target)

      expect(outcomes).toEqual(['fetch:blocked', 'fetch-localhost:blocked', 'xhr:blocked', 'ws:blocked'])
      if (guardOnly) {
        // Only the two request kinds Playwright cannot route may leak here.
        expect(leaked.every(path => path === '/prefetch' || path === '/beacon')).toBe(true)
      } else {
        expect(leaked).toEqual([])
        expect(connections).toBe(0)
      }
    } finally {
      await context.close()
    }
  }, 30_000)

  it('collects rendered color areas as lowercase #rrggbb', async (ctx) => {
    if (!handle) ctx.skip()
    const context = await handle!.browser.newContext({ viewport: { width: 1000, height: 500 } })
    try {
      const page = await context.newPage()
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#ffffff">
        <div style="width:1000px;height:200px;background:rgb(37 99 235)"></div>
        <div style="width:500px;height:100px;background:oklch(0.63 0.26 29)"></div>
        <div style="width:100px;height:100px;background:rgba(0,0,0,0.2)"></div>
        <div style="width:200px;height:50px;border:4px solid #00ff00"></div>
        <p style="color:#111111;font-size:20px">Hello world</p>
        <div style="position:absolute;top:2000px;width:100px;height:100px;background:#ff00ff"></div>
        </body></html>`)
      const areas = sanitizeColorAreas(await page.evaluate(colorAreasScript(4000)))
      expect(areas['#2563eb']).toBe(1000 * 200)
      expect(areas['#ffffff']).toBe(1000 * 1000)
      // oklch is converted through the canvas to some red
      const reds = Object.keys(areas).filter(k => parseInt(k.slice(1, 3), 16) > 200 && parseInt(k.slice(3, 5), 16) < 120)
      expect(reds.length).toBeGreaterThan(0)
      expect(areas['#00ff00']).toBeGreaterThan(0)
      expect(areas['#111111']).toBeGreaterThan(0)
      // alpha < 0.5 and elements below two viewport heights are skipped
      expect(areas['#000000']).toBeUndefined()
      expect(areas['#ff00ff']).toBeUndefined()
      expect(Object.keys(areas).every(k => /^#[0-9a-f]{6}$/.test(k))).toBe(true)
    } finally {
      await context.close()
    }
  }, 30_000)
})
