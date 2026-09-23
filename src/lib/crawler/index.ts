/**
 * Main crawler orchestrator
 * Combines Playwright and Cheerio crawlers with robots.txt respect.
 *
 * - One deadline (default 150 s) combined with the caller's signal; every
 *   fetch, evaluate and sleep observes it (A9). Hitting the deadline returns
 *   the pages crawled so far; a caller abort rejects.
 * - The start URL is fetched first and its final URL after validated
 *   redirects becomes the crawl origin, so apex→www sites keep their links
 *   and sitemap entries (A28).
 * - Up to 3 pages are fetched concurrently. Request STARTS are spaced
 *   site-wide by robots Crawl-delay (≤ 10 s) or 250 ms, across all workers.
 * - One browser per crawl, closed in `finally` (A26).
 */

import { PageData, ComputedFontInfo, FontSource, crawlPage, fetchPageCss, createCssCache } from './cheerio'
import { BrowserHandle, crawlPageWithPlaywright, openBrowser } from './playwright'
import { canCrawl, getSitemaps } from './robots'
import { safeFetch } from '../net/safe-fetch'
import { normalizeUrl, isSameSite, sortByPriority, validateUrl, PRIORITY_PATHS } from '../utils/url'

export interface CrawlResult {
  pages: PageData[]
  cssContents: Map<string, string[]>
  errors: string[]
  startTime: number
  endTime: number
  /** Start URL after validated redirects; the crawl origin. */
  finalUrl: string
}

export interface CrawlProgress {
  status: 'crawling'
  currentUrl: string
  pagesProcessed: number
  totalFound: number
}

export type ProgressCallback = (progress: CrawlProgress) => void

export interface CrawlOptions {
  signal?: AbortSignal
  /** Total crawl budget in ms. Default 150 000. */
  deadlineMs?: number
  /** Minimum gap between request starts when robots sets no Crawl-delay. Default 250 ms. */
  minGapMs?: number
}

const MAX_DEPTH = 2
const MAX_PAGES = 25
const CONCURRENCY = 3
const DEFAULT_GAP_MS = 250
const MAX_SITEMAP_BYTES = 5 * 1024 * 1024
const MAX_SITEMAP_URLS = 50

/**
 * Sleep that rejects as soon as `signal` aborts.
 */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Site-wide politeness: request starts are at least `gapMs` apart, across
 * all workers. Slots are reserved in call order, so concurrent callers queue
 * up behind each other instead of all firing after one gap.
 */
export class StartSpacer {
  private nextStart = 0
  constructor(private gapMs: number) {}

  setGap(gapMs: number): void {
    this.gapMs = Math.max(this.gapMs, gapMs)
  }

  async acquire(signal: AbortSignal): Promise<void> {
    const now = Date.now()
    const slot = Math.max(now, this.nextStart)
    this.nextStart = slot + this.gapMs
    if (slot > now) await sleep(slot - now, signal)
  }
}

/**
 * Discover same-site URLs from the sitemaps listed in robots.txt.
 */
async function discoverFromSitemap(baseUrl: string, signal: AbortSignal): Promise<string[]> {
  const sitemaps = await getSitemaps(baseUrl, signal)
  const urls: string[] = []

  for (const sitemapUrl of sitemaps.slice(0, 2)) {
    try {
      const response = await safeFetch(sitemapUrl, {
        maxBytes: MAX_SITEMAP_BYTES,
        timeoutMs: 10_000,
        signal,
      })
      if (response.status < 200 || response.status >= 300) continue

      // <loc> entries only; [^<]* keeps this linear.
      for (const match of response.text().matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)) {
        const url = match[1].replace(/&amp;/g, '&').trim()
        if (/^https?:\/\//i.test(url) && isSameSite(url, baseUrl)) {
          urls.push(url)
          if (urls.length >= MAX_SITEMAP_URLS) return urls
        }
      }
    } catch {
      signal.throwIfAborted()
      // Skip failed sitemaps
    }
  }

  return urls
}

/**
 * Generate priority URLs to try crawling
 */
function generatePriorityUrls(baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin
  return PRIORITY_PATHS.map(path => `${origin}${path}`)
}

/**
 * Whether a URL likely needs JS rendering (and therefore Playwright).
 */
function needsJsRendering(url: string, depth: number): boolean {
  return depth === 0 || /location|store|contact|about/i.test(url)
}

/**
 * Main crawl function
 */
export async function crawl(
  startUrl: string,
  onProgress?: ProgressCallback,
  opts: CrawlOptions = {}
): Promise<CrawlResult> {
  const deadlineMs = opts.deadlineMs ?? 150_000
  const startTime = Date.now()
  const deadline = AbortSignal.timeout(deadlineMs)
  const signal = opts.signal ? AbortSignal.any([opts.signal, deadline]) : deadline

  const normalizedStart = normalizeUrl(startUrl)
  const errors: string[] = []
  const pages: PageData[] = []
  const cssContents = new Map<string, string[]>()
  const cssCache = createCssCache()
  const visited = new Set<string>()
  const queued = new Set<string>()
  const queue: { url: string; depth: number }[] = []
  const spacer = new StartSpacer(opts.minGapMs ?? DEFAULT_GAP_MS)
  let finalUrl = normalizedStart

  // Launch in parallel with the first network work; closed in finally.
  const browserPromise: Promise<BrowserHandle | null> = openBrowser()

  /**
   * Fetch one page (Playwright for JS-heavy pages, Cheerio otherwise or as
   * fallback). Returns null if both fail.
   */
  const fetchPage = async (url: string, depth: number): Promise<PageData | null> => {
    const browser = needsJsRendering(url, depth) ? await browserPromise : null
    let pageData: PageData | null = null
    if (browser) {
      pageData = await crawlPageWithPlaywright(browser, url, signal)
    }
    if (!pageData) {
      signal.throwIfAborted()
      pageData = await crawlPage(url, signal)
    }
    return pageData
  }

  /**
   * Record a crawled page: dedupe by final URL, keep it on-site, fetch its
   * CSS, and enqueue its links.
   */
  const acceptPage = async (requestedUrl: string, depth: number, pageData: PageData): Promise<void> => {
    const finalPageUrl = normalizeUrl(pageData.url)
    if (!isSameSite(finalPageUrl, finalUrl)) {
      errors.push(`Redirected off-site: ${requestedUrl}`)
      return
    }
    if (finalPageUrl !== requestedUrl && visited.has(finalPageUrl)) {
      return // redirect to a page we already have
    }
    visited.add(finalPageUrl)
    if (pages.length >= MAX_PAGES) return
    pages.push(pageData)

    try {
      cssContents.set(pageData.url, await fetchPageCss(pageData, cssCache, signal))
    } catch {
      signal.throwIfAborted()
      // CSS fetch failed, continue
    }

    if (depth < MAX_DEPTH) {
      for (const link of pageData.links) {
        const normalized = normalizeUrl(link)
        if (!visited.has(normalized) && !queued.has(normalized) && isSameSite(normalized, finalUrl)) {
          queue.push({ url: normalized, depth: depth + 1 })
          queued.add(normalized)
        }
      }
      sortQueue()
    }
  }

  const sortQueue = () => {
    const depthMap = new Map(queue.map(q => [q.url, q.depth]))
    const sorted = sortByPriority(queue.map(q => q.url))
    queue.length = 0
    for (const url of sorted) queue.push({ url, depth: depthMap.get(url) ?? 1 })
  }

  const enqueue = (url: string, depth: number) => {
    const normalized = normalizeUrl(url)
    if (!queued.has(normalized) && !visited.has(normalized)) {
      queue.push({ url: normalized, depth })
      queued.add(normalized)
    }
  }

  try {
    // 1. Start page first: its final URL becomes the crawl origin (A28).
    queued.add(normalizedStart)
    const startRobots = await canCrawl(normalizedStart, signal)
    if (startRobots.crawlDelay) spacer.setGap(startRobots.crawlDelay * 1000)

    if (!startRobots.allowed) {
      errors.push(`Blocked by robots.txt: ${normalizedStart}`)
      visited.add(normalizedStart)
    } else {
      await spacer.acquire(signal)
      onProgress?.({ status: 'crawling', currentUrl: normalizedStart, pagesProcessed: 0, totalFound: queued.size })
      const startPage = await fetchPage(normalizedStart, 0)
      visited.add(normalizedStart)
      if (startPage) {
        const candidate = normalizeUrl(startPage.url)
        if (validateUrl(candidate).valid) {
          finalUrl = candidate
          await acceptPage(normalizedStart, 0, startPage)
        } else {
          errors.push(`Start URL redirected to a disallowed URL: ${candidate}`)
        }
      } else {
        errors.push(`Failed to crawl: ${normalizedStart}`)
      }
    }

    // 2. Robots delay for the final origin, priority paths and sitemap URLs.
    if (new URL(finalUrl).origin !== new URL(normalizedStart).origin) {
      const finalRobots = await canCrawl(finalUrl, signal)
      if (finalRobots.crawlDelay) spacer.setGap(finalRobots.crawlDelay * 1000)
    }
    for (const url of generatePriorityUrls(finalUrl)) enqueue(url, 1)
    try {
      for (const url of await discoverFromSitemap(finalUrl, signal)) enqueue(url, 1)
    } catch {
      signal.throwIfAborted()
      // Sitemap discovery failed, continue without it
    }
    sortQueue()

    // 3. Bounded worker pool.
    let inFlight = 0
    let wake: (() => void) | null = null
    let changed: Promise<void> = new Promise(resolve => { wake = resolve })
    const notify = () => {
      wake?.()
      changed = new Promise(resolve => { wake = resolve })
    }
    signal.addEventListener('abort', notify, { once: true })

    const processItem = async (url: string, depth: number) => {
      const { allowed, crawlDelay } = await canCrawl(url, signal)
      if (!allowed) {
        errors.push(`Blocked by robots.txt: ${url}`)
        visited.add(url)
        return
      }
      if (crawlDelay) spacer.setGap(crawlDelay * 1000)
      await spacer.acquire(signal)

      onProgress?.({ status: 'crawling', currentUrl: url, pagesProcessed: pages.length, totalFound: queued.size })

      const pageData = await fetchPage(url, depth)
      visited.add(url)
      if (!pageData) {
        errors.push(`Failed to crawl: ${url}`)
        return
      }
      await acceptPage(url, depth, pageData)
    }

    const worker = async () => {
      while (!signal.aborted) {
        const full = pages.length + inFlight >= MAX_PAGES
        const item = full ? undefined : queue.shift()
        if (!item) {
          if (inFlight === 0) return
          await changed
          continue
        }
        if (visited.has(item.url)) continue

        inFlight++
        try {
          await processItem(item.url, item.depth)
        } catch (error) {
          if (signal.aborted) return
          errors.push(`Failed to crawl: ${item.url} (${error instanceof Error ? error.message : String(error)})`)
        } finally {
          inFlight--
          notify()
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    signal.removeEventListener('abort', notify)
  } catch (error) {
    if (!signal.aborted) throw error
  } finally {
    const browser = await browserPromise.catch(() => null)
    await browser?.close()
  }

  if (opts.signal?.aborted) {
    throw opts.signal.reason
  }
  if (deadline.aborted) {
    errors.push('Total crawl timeout exceeded')
  }

  return {
    pages,
    cssContents,
    errors,
    startTime,
    endTime: Date.now(),
    finalUrl,
  }
}

export type { PageData, ComputedFontInfo, FontSource }
