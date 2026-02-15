/**
 * Main crawler orchestrator
 * Combines Playwright and Cheerio crawlers with robots.txt respect
 */

import { PageData, ComputedFontInfo, FontSource, crawlPage, fetchPageCss } from './cheerio'
import { crawlPageWithPlaywright, closeBrowser, isPlaywrightAvailable } from './playwright'
import { canCrawl, getSitemaps } from './robots'
import { normalizeUrl, isSameOrigin, sortByPriority, PRIORITY_PATHS } from '../utils/url'

export interface CrawlResult {
  pages: PageData[]
  cssContents: Map<string, string[]>
  errors: string[]
  startTime: number
  endTime: number
}

export interface CrawlProgress {
  status: 'crawling'
  currentUrl: string
  pagesProcessed: number
  totalFound: number
}

export type ProgressCallback = (progress: CrawlProgress) => void

const MAX_DEPTH = 2
const MAX_PAGES = 25
const RATE_LIMIT_MS = 1000 // 1 request per second
const TOTAL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Discover initial URLs from sitemap
 */
async function discoverFromSitemap(baseUrl: string): Promise<string[]> {
  const sitemaps = await getSitemaps(baseUrl)
  const urls: string[] = []

  for (const sitemapUrl of sitemaps.slice(0, 2)) {
    try {
      const response = await fetch(sitemapUrl, {
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) continue

      const text = await response.text()

      // Simple regex to extract URLs from sitemap XML
      const urlMatches = text.matchAll(/<loc>([^<]+)<\/loc>/g)
      for (const match of urlMatches) {
        const url = match[1].trim()
        if (isSameOrigin(url, baseUrl)) {
          urls.push(url)
        }
      }
    } catch {
      // Skip failed sitemaps
    }
  }

  return urls.slice(0, 50) // Limit sitemap URLs
}

/**
 * Generate priority URLs to try crawling
 */
function generatePriorityUrls(baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin
  return PRIORITY_PATHS.map(path => `${origin}${path}`)
}

/**
 * Main crawl function
 */
export async function crawl(
  startUrl: string,
  onProgress?: ProgressCallback
): Promise<CrawlResult> {
  const normalizedStart = normalizeUrl(startUrl)
  const startTime = Date.now()
  const errors: string[] = []
  const pages: PageData[] = []
  const cssContents = new Map<string, string[]>()
  const visited = new Set<string>()
  const queued = new Set<string>()

  // Track URLs to visit with their depth
  const queue: { url: string; depth: number }[] = []

  // Check if Playwright is available
  const usePlaywright = await isPlaywrightAvailable()

  // Add start URL
  queue.push({ url: normalizedStart, depth: 0 })
  queued.add(normalizedStart)

  // Add priority URLs
  const priorityUrls = generatePriorityUrls(normalizedStart)
  for (const url of priorityUrls) {
    if (!queued.has(url)) {
      queue.push({ url, depth: 1 })
      queued.add(url)
    }
  }

  // Try to discover URLs from sitemap
  try {
    const sitemapUrls = await discoverFromSitemap(normalizedStart)
    for (const url of sitemapUrls) {
      const normalized = normalizeUrl(url)
      if (!queued.has(normalized)) {
        queue.push({ url: normalized, depth: 1 })
        queued.add(normalized)
      }
    }
  } catch {
    // Sitemap discovery failed, continue without it
  }

  // Sort queue to prioritize important pages
  const sortedQueue = sortByPriority(queue.map(q => q.url))
  const depthMap = new Map(queue.map(q => [q.url, q.depth]))
  queue.length = 0
  for (const url of sortedQueue) {
    queue.push({ url, depth: depthMap.get(url) || 1 })
  }

  // Track rate limiting
  let lastRequestTime = 0

  while (queue.length > 0 && pages.length < MAX_PAGES) {
    // Check total timeout
    if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
      errors.push('Total crawl timeout exceeded')
      break
    }

    const { url, depth } = queue.shift()!

    if (visited.has(url)) {
      continue
    }

    // Check robots.txt
    const { allowed, crawlDelay } = await canCrawl(url)
    if (!allowed) {
      errors.push(`Blocked by robots.txt: ${url}`)
      visited.add(url)
      continue
    }

    // Apply rate limiting
    const now = Date.now()
    const minDelay = Math.max(RATE_LIMIT_MS, (crawlDelay || 0) * 1000)
    const timeSinceLastRequest = now - lastRequestTime

    if (timeSinceLastRequest < minDelay) {
      await sleep(minDelay - timeSinceLastRequest)
    }

    lastRequestTime = Date.now()

    // Report progress
    if (onProgress) {
      onProgress({
        status: 'crawling',
        currentUrl: url,
        pagesProcessed: pages.length,
        totalFound: queued.size,
      })
    }

    // Try to crawl the page
    let pageData: PageData | null = null

    // Check if this is a page that likely needs JS rendering
    const needsJsRendering = depth === 0 || /location|store|contact|about/i.test(url)

    // First try Playwright for JS-rendered content
    if (usePlaywright && needsJsRendering) {
      try {
        pageData = await crawlPageWithPlaywright(url)
      } catch (error) {
        console.error(`Playwright crawl failed for ${url}:`, error)
      }
    }

    // Fall back to Cheerio
    if (!pageData) {
      pageData = await crawlPage(url)
    }

    if (!pageData) {
      errors.push(`Failed to crawl: ${url}`)
      visited.add(url)
      continue
    }

    visited.add(url)
    pages.push(pageData)

    // Fetch CSS for this page
    try {
      const css = await fetchPageCss(pageData)
      cssContents.set(url, css)
    } catch {
      // CSS fetch failed, continue
    }

    // Add discovered links to queue (if not at max depth)
    if (depth < MAX_DEPTH) {
      for (const link of pageData.links) {
        const normalized = normalizeUrl(link)
        if (!visited.has(normalized) && !queued.has(normalized) && isSameOrigin(normalized, normalizedStart)) {
          queue.push({ url: normalized, depth: depth + 1 })
          queued.add(normalized)
        }
      }

      // Re-sort queue to prioritize important pages
      const urls = queue.map(q => q.url)
      const sorted = sortByPriority(urls)
      const newDepthMap = new Map(queue.map(q => [q.url, q.depth]))
      queue.length = 0
      for (const qurl of sorted) {
        queue.push({ url: qurl, depth: newDepthMap.get(qurl) || depth + 1 })
      }
    }
  }

  // Clean up Playwright browser
  await closeBrowser()

  return {
    pages,
    cssContents,
    errors,
    startTime,
    endTime: Date.now(),
  }
}

export type { PageData, ComputedFontInfo, FontSource }
