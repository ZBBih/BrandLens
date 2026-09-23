/**
 * Cheerio-based static HTML crawler
 *
 * All network access goes through safeFetch (audit A1, A24, A27): HTML is
 * capped at 3 MB and must be text/html or application/xhtml+xml; CSS is
 * capped at 1 MB and must be text/css (or untyped). Stylesheets are cached
 * per crawl so each URL is fetched once.
 */

import * as cheerio from 'cheerio'
import { safeFetch } from '../net/safe-fetch'
import { isSameOrigin, normalizeUrl } from '../utils/url'

export interface ComputedFontInfo {
  fontFamily: string
  fontWeight: string
  fontSize: string
  lineHeight: string
  letterSpacing: string
  element: string
}

export interface FontSource {
  type: 'google' | 'adobe' | 'fontface'
  url: string
  fonts?: string[]
}

export interface PageData {
  url: string
  html: string
  title: string
  description: string
  keywords: string[]
  ogData: Record<string, string>
  twitterData: Record<string, string>
  headings: { level: number; text: string }[]
  links: string[]
  images: { src: string; alt: string }[]
  cssUrls: string[]
  inlineCss: string[]
  navLabels: string[]
  ctaButtons: string[]
  footerContent: string
  schemaData: Record<string, unknown>[]
  // Computed font data from Playwright
  computedFonts?: Record<string, ComputedFontInfo>
  fontSources?: FontSource[]
  /**
   * Rendered area per colour, Playwright pages only. Keys are lowercase
   * '#rrggbb'; values are px² summed over visible elements in the first two
   * viewport heights (background fills + approximate text area + borders).
   */
  colorAreas?: Record<string, number>
}

const REQUEST_TIMEOUT = 30000 // 30 seconds
const MAX_HTML_BYTES = 3 * 1024 * 1024
const MAX_CSS_BYTES = 1024 * 1024
const MAX_CSS_PER_PAGE = 10
const HTML_TYPES = ['text/html', 'application/xhtml+xml']
const CSS_TYPES = ['text/css', '']

/**
 * Crawl-scoped stylesheet cache: URL -> in-flight or finished fetch.
 * Storing the promise dedupes concurrent requests from parallel workers.
 */
export type CssCache = Map<string, Promise<string | null>>

export function createCssCache(): CssCache {
  return new Map()
}

/**
 * Fetch an HTML page. Returns the body and the final URL after validated
 * redirects, or null on any failure.
 */
export async function fetchHtmlPage(
  url: string,
  signal?: AbortSignal
): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const response = await safeFetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      accept: HTML_TYPES,
      maxBytes: MAX_HTML_BYTES,
      timeoutMs: REQUEST_TIMEOUT,
      signal,
    })

    if (response.status < 200 || response.status >= 300) {
      return null
    }

    return { html: response.text(), finalUrl: response.url }
  } catch {
    signal?.throwIfAborted()
    return null
  }
}

/**
 * Fetch HTML content from a URL
 */
export async function fetchHtml(url: string, signal?: AbortSignal): Promise<string | null> {
  const page = await fetchHtmlPage(url, signal)
  return page ? page.html : null
}

/**
 * Fetch CSS content from a URL
 */
export async function fetchCss(url: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await safeFetch(url, {
      headers: {
        'Accept': 'text/css,*/*;q=0.1',
      },
      accept: CSS_TYPES,
      maxBytes: MAX_CSS_BYTES,
      timeoutMs: REQUEST_TIMEOUT,
      signal,
    })

    if (response.status < 200 || response.status >= 300) {
      return null
    }

    return response.text()
  } catch {
    signal?.throwIfAborted()
    return null
  }
}

/**
 * Parse HTML and extract page data using Cheerio
 */
export function parseHtml(html: string, pageUrl: string): PageData {
  const $ = cheerio.load(html)

  // Extract title
  const title = $('title').first().text().trim()

  // Extract meta description
  const description = $('meta[name="description"]').attr('content')?.trim() || ''

  // Extract meta keywords
  const keywordsStr = $('meta[name="keywords"]').attr('content') || ''
  const keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean)

  // Extract OpenGraph data
  const ogData: Record<string, string> = {}
  $('meta[property^="og:"]').each((_, el) => {
    const property = $(el).attr('property')?.replace('og:', '')
    const content = $(el).attr('content')
    if (property && content) {
      ogData[property] = content
    }
  })

  // Extract Twitter Card data
  const twitterData: Record<string, string> = {}
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name')?.replace('twitter:', '')
    const content = $(el).attr('content')
    if (name && content) {
      twitterData[name] = content
    }
  })

  // Extract headings (H1-H3)
  const headings: { level: number; text: string }[] = []
  $('h1, h2, h3').each((_, el) => {
    const level = parseInt(el.tagName.slice(1), 10)
    const text = $(el).text().trim()
    if (text) {
      headings.push({ level, text })
    }
  })

  // Extract same-origin links
  const links: string[] = []
  const seenLinks = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return
    }

    try {
      const fullUrl = new URL(href, pageUrl).toString()
      const normalized = normalizeUrl(fullUrl)

      if (isSameOrigin(normalized, pageUrl) && !seenLinks.has(normalized)) {
        seenLinks.add(normalized)
        links.push(normalized)
      }
    } catch {
      // Invalid URL, skip
    }
  })

  // Extract images with alt text
  const images: { src: string; alt: string }[] = []
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src')
    const alt = $(el).attr('alt') || ''
    if (src) {
      try {
        const fullSrc = new URL(src, pageUrl).toString()
        images.push({ src: fullSrc, alt })
      } catch {
        // Invalid URL, skip
      }
    }
  })

  // Extract CSS URLs
  const cssUrls: string[] = []
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr('href')
    if (href) {
      try {
        const fullUrl = new URL(href, pageUrl).toString()
        cssUrls.push(fullUrl)
      } catch {
        // Invalid URL, skip
      }
    }
  })

  // Extract inline CSS
  const inlineCss: string[] = []
  $('style').each((_, el) => {
    const css = $(el).text().trim()
    if (css) {
      inlineCss.push(css)
    }
  })

  // Extract navigation labels
  const navLabels: string[] = []
  $('nav a, header a, [role="navigation"] a').each((_, el) => {
    const text = $(el).text().trim()
    if (text && text.length < 50) {
      navLabels.push(text)
    }
  })

  // Extract CTA button text
  const ctaButtons: string[] = []
  $('button, a.btn, a.button, [role="button"], .cta, .btn, input[type="submit"]').each((_, el) => {
    const text = $(el).text().trim() || $(el).attr('value') || ''
    if (text && text.length < 100) {
      ctaButtons.push(text)
    }
  })

  // Extract footer content
  const footerContent = $('footer').text().trim().slice(0, 2000)

  // Extract JSON-LD schema data
  const schemaData: Record<string, unknown>[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text()
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) {
        schemaData.push(...parsed)
      } else {
        schemaData.push(parsed)
      }
    } catch {
      // Invalid JSON, skip
    }
  })

  return {
    url: pageUrl,
    html,
    title,
    description,
    keywords,
    ogData,
    twitterData,
    headings,
    links,
    images,
    cssUrls,
    inlineCss,
    navLabels,
    ctaButtons,
    footerContent,
    schemaData,
  }
}

/**
 * Crawl a single page using Cheerio. PageData.url is the final URL after
 * validated redirects.
 */
export async function crawlPage(url: string, signal?: AbortSignal): Promise<PageData | null> {
  const page = await fetchHtmlPage(url, signal)
  if (!page) {
    return null
  }

  return parseHtml(page.html, page.finalUrl)
}

/**
 * Fetch all CSS content for a page (inline CSS plus up to 10 external
 * stylesheets). With a crawl-scoped cache, each stylesheet URL is fetched
 * at most once per crawl.
 */
export async function fetchPageCss(
  pageData: PageData,
  cache: CssCache = createCssCache(),
  signal?: AbortSignal
): Promise<string[]> {
  const cssContents: string[] = [...pageData.inlineCss]

  const urls = pageData.cssUrls
    .filter(u => /^https?:\/\//i.test(u))
    .slice(0, MAX_CSS_PER_PAGE)

  const results = await Promise.all(urls.map((url) => {
    let pending = cache.get(url)
    if (!pending) {
      pending = fetchCss(url, signal)
      cache.set(url, pending)
    }
    return pending
  }))

  for (const css of results) {
    if (css) {
      cssContents.push(css)
    }
  }

  return cssContents
}
