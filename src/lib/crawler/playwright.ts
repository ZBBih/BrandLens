/**
 * Playwright-based crawler for JavaScript-rendered pages
 * With robust multi-layer font detection and rendered color areas.
 *
 * Security model (audit A3, A25, A26):
 * - One browser per crawl (openBrowser → handle), closed by the caller in
 *   `finally`. No module-global singleton, so concurrent jobs never share or
 *   close each other's browser, and there is no launch race.
 * - Every request the page makes is intercepted with context.route and
 *   answered by safeFetch (IP-pinned, redirects returned as 3xx for Chromium
 *   to re-request through the same route). Some traffic never reaches
 *   Playwright routing: <link rel=prefetch>, navigator.sendBeacon and
 *   preconnect sockets (see playwright.test.ts). So Chromium itself is
 *   pointed at a dead proxy and has non-proxied UDP (WebRTC) disabled; that
 *   traffic cannot reach the network either.
 * - Service workers are blocked (they would bypass routing).
 * - Every page.evaluate is bounded by a hard timeout and its result is
 *   validated, because page JS controls the main world.
 */

import { chromium, Browser, BrowserContext, Page, Route } from 'playwright'
import { parseHtml, PageData, ComputedFontInfo, FontSource } from './cheerio'
import { safeFetch, USER_AGENT } from '../net/safe-fetch'
import {
  getTypographyExtractionScript,
  processExtractionResult,
  TypographyExtractionResult
} from '../extractors/typographyExtractor'
import { LEGACY_TYPOGRAPHY_SCRIPT, STYLESHEETS_SCRIPT, colorAreasScript } from './page-scripts'
import {
  LIMITS,
  bool,
  isRecord,
  sanitizeColorAreas,
  sanitizeStylesheets,
  str,
  strArray,
  strRecord,
} from './sanitize'

const PAGE_TIMEOUT = 30000 // 30 seconds for navigation
const NETWORK_IDLE_WAIT_MS = 3000
const FONTS_READY_WAIT_MS = 1500
const EVALUATE_TIMEOUT_MS = 8000
const COLOR_AREA_MAX_ELEMENTS = 4000

/** Resource types Chromium may load; everything else is aborted. Fonts stay: detection uses document.fonts. */
const ALLOWED_RESOURCE_TYPES = new Set(['document', 'stylesheet', 'script', 'font', 'xhr', 'fetch'])

/** Byte caps per resource type for routed requests. */
const ROUTE_MAX_BYTES: Record<string, number> = {
  document: 3 * 1024 * 1024,
  script: 3 * 1024 * 1024,
  stylesheet: 1024 * 1024,
  font: 1024 * 1024,
  xhr: 1024 * 1024,
  fetch: 1024 * 1024,
}

/** Request headers never forwarded from Chromium to safeFetch. */
const DROP_REQUEST_HEADERS = new Set([
  'host', 'connection', 'content-length', 'accept-encoding', 'transfer-encoding',
  'upgrade', 'keep-alive', 'te', 'trailer', 'user-agent', 'proxy-authorization', 'proxy-connection',
])

/** Response headers that no longer describe the decoded body we hand back. */
const DROP_RESPONSE_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive'])

/**
 * A browser owned by exactly one crawl.
 */
export interface BrowserHandle {
  browser: Browser
  close(): Promise<void>
}

/**
 * Launch a browser for one crawl. Returns null when Chromium is unavailable.
 */
export async function openBrowser(): Promise<BrowserHandle | null> {
  const args = [
    '--disable-dev-shm-usage',
    '--disable-gpu',
    // WebRTC must not open UDP sockets that bypass request routing.
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    '--webrtc-ip-handling-policy=disable_non_proxied_udp',
    // Do not implicitly bypass the (dead) proxy for loopback.
    '--proxy-bypass-list=<-loopback>',
  ]
  // Chromium refuses to start its sandbox when running as root, and Railway
  // runs containers as root. Only then do we fall back to --no-sandbox; as a
  // non-root user the renderer sandbox stays on.
  if (typeof process.getuid === 'function' && process.getuid() === 0) {
    args.push('--no-sandbox', '--disable-setuid-sandbox')
  }

  try {
    const browser = await chromium.launch({
      headless: true,
      args,
      // Every request is answered by context.route via safeFetch. Anything
      // Chromium tries to send on its own goes to this unreachable proxy.
      proxy: { server: 'http://127.0.0.1:9' },
    })
    let closed = false
    return {
      browser,
      async close() {
        if (closed) return
        closed = true
        await browser.close().catch(() => {})
      },
    }
  } catch (error) {
    console.error('Playwright launch failed:', error)
    return null
  }
}

/**
 * Robust typography extraction result
 */
export interface RobustTypographyResult {
  computedFonts: Record<string, ComputedFontInfo>
  fontSources: FontSource[]
  loadedFonts: string[]
  googleFonts: string[]
  adobeFontsDetected: boolean
  cssVariables: Record<string, string>
  fontFaceDeclarations: string[]
}

/**
 * Network-intercepted font information
 */
interface InterceptedFont {
  url: string
  type: 'google' | 'adobe' | 'fontfile'
  fontNames: string[]
}

/**
 * Computed font info as returned by the legacy in-page script.
 */
interface RawComputedFont extends ComputedFontInfo {
  rawStack: string
}

/**
 * Validated result of LEGACY_TYPOGRAPHY_SCRIPT.
 */
interface LegacyTypographyData {
  computedFonts: Record<string, RawComputedFont>
  cssVariables: Record<string, string>
  loadedFonts: string[]
  loadedFontsWithWeights: { name: string; weights: string[] }[]
  googleFonts: string[]
  hasAdobeFonts: boolean
  fontFaceDeclarations: string[]
  fontSources: FontSource[]
}

/**
 * Extended page data with comprehensive typography extraction
 */
export interface ExtendedPageData extends PageData {
  typographyExtraction?: TypographyExtractionResult
  loadedFonts?: string[]
  loadedFontsWithWeights?: { name: string; weights: string[] }[]
  googleFonts?: string[]
  cssVariables?: Record<string, string>
  networkFontFiles?: string[]
  hasAdobeFonts?: boolean
}

/**
 * Extract font names from a Google Fonts URL
 */
function parseGoogleFontsUrlFromNetwork(url: string): string[] {
  const fonts: string[] = []
  try {
    const familyMatches = url.match(/family=([^&]+)/g)
    if (familyMatches) {
      familyMatches.forEach(match => {
        const familyStr = match.replace('family=', '')
        familyStr.split('|').forEach(family => {
          const name = decodeURIComponent(family.split(':')[0].replace(/\+/g, ' ')).trim()
          if (name && !fonts.includes(name)) {
            fonts.push(name)
          }
        })
      })
    }
  } catch {
    // Malformed percent-encoding: return what we have
  }
  return fonts
}

/**
 * Extract font name from a font file URL path
 */
function extractFontNameFromPath(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const filename = urlObj.pathname.split('/').pop() || ''
    // Remove extension
    let name = filename.replace(/\.(woff2?|ttf|otf|eot)$/i, '')
    // Remove weight/style suffixes
    name = name.replace(/[-_](regular|bold|italic|light|medium|semibold|extrabold|thin|black|heavy|book|normal|\d{3})$/gi, '')
    // Convert dashes/underscores to spaces and clean up
    name = name.replace(/[-_]/g, ' ').trim()
    // Skip if it looks like a hash or encoded string
    if (name.length > 3 && !/^[a-zA-Z0-9]{20,}$/.test(name) && !/^[A-Za-z0-9+/=]+$/.test(name)) {
      return name
    }
  } catch {
    // Invalid URL
  }
  return null
}

/**
 * Check if a font name is an icon font (should be filtered out)
 */
function isIconFont(name: string): boolean {
  const iconPatterns = [
    'fontawesome', 'font awesome', 'fa-', 'fa solid', 'fa brands', 'fa regular',
    'material', 'icon', 'awb-icons', 'revicons', 'icomoon', 'glyphicon',
    'dashicons', 'eleganticons', 'feather', 'ionicons'
  ]
  const lower = name.toLowerCase()
  return iconPatterns.some(p => lower.includes(p))
}

/**
 * Reject after `ms`, or when `signal` aborts. The underlying work is not
 * cancelled; the caller closes the context, which ends it.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    const onAbort = () => reject(signal?.reason ?? new Error('Aborted'))
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (err: unknown) => {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(err)
      }
    )
  })
}

/**
 * Evaluate a script string with a hard timeout. The result is `unknown`
 * and must be validated.
 */
function evaluateBounded(page: Page, script: string, label: string, signal?: AbortSignal): Promise<unknown> {
  return withTimeout(page.evaluate(script) as Promise<unknown>, EVALUATE_TIMEOUT_MS, label, signal)
}

/**
 * Answer one intercepted request through safeFetch.
 */
async function handleRoute(route: Route, signal: AbortSignal | undefined): Promise<void> {
  const request = route.request()
  const type = request.resourceType()
  if (!ALLOWED_RESOURCE_TYPES.has(type)) {
    await route.abort('blockedbyclient').catch(() => {})
    return
  }

  const headers: Record<string, string> = {}
  for (const [name, value] of Object.entries(request.headers())) {
    const lower = name.toLowerCase()
    if (!DROP_REQUEST_HEADERS.has(lower) && !lower.startsWith('sec-') && !lower.startsWith(':')) {
      headers[lower] = value
    }
  }

  try {
    const res = await safeFetch(request.url(), {
      method: request.method(),
      headers,
      body: request.postDataBuffer() ?? undefined,
      // Playwright only routes the first URL of a redirect chain: a 3xx handed
      // back to Chromium would make it fetch the next hop itself, outside this
      // guard. Subresources therefore follow redirects here (every hop is
      // re-validated); navigations are pre-resolved in crawlPageWithPlaywright
      // so they never redirect, and any that still do fail closed.
      redirect: type === 'document' ? 'manual' : 'follow',
      maxBytes: ROUTE_MAX_BYTES[type] ?? 1024 * 1024,
      timeoutMs: 15_000,
      signal,
    })
    // A cut-off script, stylesheet or font is worse than none.
    if (res.truncated && type !== 'document') {
      await route.abort('failed').catch(() => {})
      return
    }
    const responseHeaders: Record<string, string> = {}
    for (const [name, value] of Object.entries(res.headers)) {
      if (!DROP_RESPONSE_HEADERS.has(name)) responseHeaders[name] = value
    }
    await route.fulfill({ status: res.status, headers: responseHeaders, body: res.body })
  } catch {
    await route.abort('blockedbyclient').catch(() => {})
  }
}

/**
 * Follow a URL's redirects through safeFetch and return where it lands, or
 * null if it is blocked, fails, or is not an HTML page
 */
async function resolveNavigationTarget(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await safeFetch(url, {
      redirect: 'follow',
      maxBytes: 16 * 1024,
      timeoutMs: 15_000,
      signal,
      accept: ['text/html', 'application/xhtml+xml'],
    })
    return res.status < 400 ? res.url : null
  } catch {
    return null
  }
}

/**
 * Route every request of a context through safeFetch so Chromium never opens
 * its own connection (iframes and subresources included), and refuse
 * WebSockets, which rendering does not need.
 */
export async function installEgressGuard(context: BrowserContext, signal?: AbortSignal): Promise<void> {
  await context.route('**/*', route => handleRoute(route, signal))
  await context.routeWebSocket(/.*/, ws => {
    ws.close({ code: 1008, reason: 'Blocked by BrandLens' })
  })
}

/**
 * Validate the legacy typography script's result.
 */
function sanitizeLegacyTypography(raw: unknown): LegacyTypographyData {
  const r = isRecord(raw) ? raw : {}

  const computedFonts: Record<string, RawComputedFont> = {}
  if (isRecord(r.computedFonts)) {
    for (const [role, v] of Object.entries(r.computedFonts).slice(0, 20)) {
      if (!isRecord(v)) continue
      computedFonts[role.slice(0, 50)] = {
        fontFamily: str(v.fontFamily),
        fontWeight: str(v.fontWeight, 20),
        fontSize: str(v.fontSize, 20),
        lineHeight: str(v.lineHeight, 20),
        letterSpacing: str(v.letterSpacing, 20),
        element: str(v.element),
        rawStack: str(v.rawStack, LIMITS.longString),
      }
    }
  }

  const loadedFontsWithWeights: { name: string; weights: string[] }[] = []
  if (Array.isArray(r.loadedFontsWithWeights)) {
    for (const v of r.loadedFontsWithWeights.slice(0, LIMITS.arrayItems)) {
      if (isRecord(v) && typeof v.name === 'string') {
        loadedFontsWithWeights.push({ name: str(v.name), weights: strArray(v.weights, 20, 20) })
      }
    }
  }

  const fontSources: FontSource[] = []
  if (Array.isArray(r.fontSources)) {
    for (const v of r.fontSources.slice(0, 50)) {
      if (!isRecord(v)) continue
      if (v.type !== 'google' && v.type !== 'adobe' && v.type !== 'fontface') continue
      const source: FontSource = { type: v.type, url: str(v.url, LIMITS.longString) }
      if (Array.isArray(v.fonts)) source.fonts = strArray(v.fonts)
      fontSources.push(source)
    }
  }

  return {
    computedFonts,
    cssVariables: strRecord(r.cssVariables),
    loadedFonts: strArray(r.loadedFonts),
    loadedFontsWithWeights,
    googleFonts: strArray(r.googleFonts),
    hasAdobeFonts: bool(r.hasAdobeFonts),
    fontFaceDeclarations: strArray(r.fontFaceDeclarations),
    fontSources,
  }
}

/**
 * Crawl a single page using Playwright with robust font detection.
 * The context is always closed; the browser belongs to the caller.
 */
export async function crawlPageWithPlaywright(
  handle: BrowserHandle,
  url: string,
  signal?: AbortSignal
): Promise<ExtendedPageData | null> {
  signal?.throwIfAborted()
  let context: BrowserContext | null = null
  const closeContext = () => {
    context?.close().catch(() => {})
  }
  signal?.addEventListener('abort', closeContext, { once: true })

  try {
    context = await handle.browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      serviceWorkers: 'block',
    })

    await installEgressGuard(context, signal)

    const page = await context.newPage()

    // Collect font information from network responses
    const interceptedFonts: InterceptedFont[] = []
    page.on('response', response => {
      const responseUrl = response.url()
      const contentType = response.headers()['content-type'] || ''

      if (responseUrl.includes('fonts.googleapis.com')) {
        const fontNames = parseGoogleFontsUrlFromNetwork(responseUrl)
        if (fontNames.length > 0) {
          interceptedFonts.push({ url: responseUrl, type: 'google', fontNames })
        }
      }

      if (responseUrl.includes('use.typekit.net') || responseUrl.includes('p.typekit.net')) {
        interceptedFonts.push({ url: responseUrl, type: 'adobe', fontNames: [] })
      }

      if (responseUrl.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i) || contentType.includes('font')) {
        const fontName = extractFontNameFromPath(responseUrl)
        if (fontName && !isIconFont(fontName)) {
          interceptedFonts.push({ url: responseUrl, type: 'fontfile', fontNames: [fontName] })
        }
      }
    })

    // Resolve redirects through the guard first, so the navigation itself
    // never redirects (see handleRoute)
    const target = await resolveNavigationTarget(url, signal)
    if (!target) return null

    // Navigate: DOM first, then a bounded wait for the network to settle,
    // then a bounded wait for web fonts. No fixed sleeps.
    const response = await withTimeout(
      page.goto(target, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT }),
      PAGE_TIMEOUT + 1000,
      'navigation',
      signal
    )

    if (!response || !response.ok()) {
      return null
    }

    await withTimeout(page.waitForLoadState('networkidle'), NETWORK_IDLE_WAIT_MS, 'networkidle', signal).catch(() => {})
    signal?.throwIfAborted()
    await withTimeout(page.evaluate('document.fonts.ready.then(() => true)'), FONTS_READY_WAIT_MS, 'fonts.ready', signal).catch(() => {})
    signal?.throwIfAborted()

    // Comprehensive typography extraction (scans visible text elements)
    const typographyExtraction = processExtractionResult(
      await evaluateBounded(page, getTypographyExtractionScript(), 'typography extraction', signal)
    )

    // Multi-layer detection (legacy, for backwards compat)
    const typographyData = sanitizeLegacyTypography(
      await evaluateBounded(page, LEGACY_TYPOGRAPHY_SCRIPT, 'legacy typography', signal)
    )

    // Rendered color areas; optional, so failure leaves it undefined.
    const colorAreas = await evaluateBounded(page, colorAreasScript(COLOR_AREA_MAX_ELEMENTS), 'color areas', signal)
      .then(sanitizeColorAreas)
      .catch(() => undefined)

    // Rendered HTML and all readable CSS (including dynamically loaded)
    const html = (await withTimeout(page.content(), EVALUATE_TIMEOUT_MS, 'page.content', signal)).slice(0, LIMITS.htmlBytes)
    const stylesheets = sanitizeStylesheets(await evaluateBounded(page, STYLESHEETS_SCRIPT, 'stylesheets', signal))

    // Parse the HTML against the final URL so links resolve after redirects
    const pageData: ExtendedPageData = parseHtml(html, page.url() || target)
    pageData.inlineCss = [...pageData.inlineCss, ...stylesheets]
    if (colorAreas && Object.keys(colorAreas).length > 0) {
      pageData.colorAreas = colorAreas
    }

    // Process and resolve fonts
    const resolvedFonts = resolveFontData(typographyData)
    pageData.computedFonts = resolvedFonts.computedFonts
    pageData.fontSources = typographyData.fontSources

    // Additional font data for the typography extractor
    pageData.loadedFonts = typographyData.loadedFonts
    pageData.loadedFontsWithWeights = typographyData.loadedFontsWithWeights
    pageData.cssVariables = typographyData.cssVariables

    // Merge network-detected fonts with page-detected fonts
    const networkGoogleFonts = interceptedFonts
      .filter(f => f.type === 'google')
      .flatMap(f => f.fontNames)
    const networkFontFiles = interceptedFonts
      .filter(f => f.type === 'fontfile')
      .flatMap(f => f.fontNames)
    const hasNetworkAdobeFonts = interceptedFonts.some(f => f.type === 'adobe')

    pageData.googleFonts = [...new Set([...typographyData.googleFonts, ...networkGoogleFonts])]
    pageData.networkFontFiles = [...new Set(networkFontFiles)].slice(0, LIMITS.arrayItems)
    pageData.hasAdobeFonts = typographyData.hasAdobeFonts || hasNetworkAdobeFonts
    pageData.typographyExtraction = typographyExtraction

    return pageData
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    console.error(`Playwright crawl error for ${url}:`, error instanceof Error ? error.message : error)
    return null
  } finally {
    signal?.removeEventListener('abort', closeContext)
    if (context) await context.close().catch(() => {})
  }
}

/**
 * Resolve font names from CSS variables and cross-reference with detected fonts
 */
function resolveFontData(data: LegacyTypographyData): { computedFonts: Record<string, ComputedFontInfo> } {
  const { computedFonts, cssVariables, loadedFonts, googleFonts, fontFaceDeclarations } = data
  const resolved: Record<string, ComputedFontInfo> = {}

  /**
   * Recursively resolve CSS variable references
   */
  const resolveVariable = (value: string, depth = 0): string => {
    if (depth > 5) return value // Prevent infinite recursion
    if (!value || !value.includes('var(')) return value

    const varMatch = value.match(/var\(([^),]+)(?:,\s*([^)]+))?\)/)
    if (!varMatch) return value

    const varName = varMatch[1].trim()
    const fallback = varMatch[2]?.trim()

    // Try to resolve from collected CSS variables
    const fromVars = cssVariables[varName]
    if (fromVars) {
      return resolveVariable(fromVars, depth + 1)
    }

    // Use fallback if available
    if (fallback) {
      return resolveVariable(fallback, depth + 1)
    }

    return value
  }

  for (const [role, fd] of Object.entries(computedFonts)) {
    let fontName = fd.fontFamily

    // Step 1: Resolve CSS variables (with recursion support)
    if (fontName.includes('var(')) {
      fontName = resolveVariable(fontName)
      // Extract first font from the resolved stack
      if (!fontName.includes('var(')) {
        fontName = fontName.split(',')[0].trim().replace(/['"]/g, '')
      }
    }

    // Step 2: If still unresolved or unknown, try loaded fonts
    if (fontName.includes('var(') || fontName.startsWith('--') || fontName === 'Unknown' || fontName === '') {
      if (loadedFonts.length > 0) {
        fontName = loadedFonts[0]
      } else if (googleFonts.length > 0) {
        fontName = googleFonts[0]
      } else if (fontFaceDeclarations.length > 0) {
        fontName = fontFaceDeclarations[0]
      } else {
        fontName = 'Custom Font (unidentified)'
      }
    }

    // Step 3: Cross-reference with Google Fonts (most reliable)
    const rawStack = fd.rawStack || ''
    const googleMatch = googleFonts.find(gf =>
      rawStack.toLowerCase().includes(gf.toLowerCase()) ||
      fontName.toLowerCase().includes(gf.toLowerCase())
    )
    if (googleMatch) {
      fontName = googleMatch
    }

    // Step 4: Check against @font-face declarations
    if (!googleMatch && fontName !== 'Custom Font (unidentified)') {
      const fontFaceMatch = fontFaceDeclarations.find(ff =>
        rawStack.toLowerCase().includes(ff.toLowerCase()) ||
        fontName.toLowerCase().includes(ff.toLowerCase())
      )
      if (fontFaceMatch) {
        fontName = fontFaceMatch
      }
    }

    resolved[role] = {
      fontFamily: fontName,
      fontWeight: fd.fontWeight,
      fontSize: fd.fontSize,
      lineHeight: fd.lineHeight,
      letterSpacing: fd.letterSpacing,
      element: fd.element
    }
  }

  return { computedFonts: resolved }
}
