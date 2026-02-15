/**
 * Cheerio-based static HTML crawler
 */

import * as cheerio from 'cheerio'
import { USER_AGENT } from './robots'
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
}

const REQUEST_TIMEOUT = 30000 // 30 seconds

/**
 * Fetch HTML content from a URL
 */
export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      redirect: 'follow',
    })

    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null
    }

    return await response.text()
  } catch {
    return null
  }
}

/**
 * Fetch CSS content from a URL
 */
export async function fetchCss(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/css,*/*;q=0.1',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    })

    if (!response.ok) {
      return null
    }

    return await response.text()
  } catch {
    return null
  }
}

/**
 * Parse HTML and extract page data using Cheerio
 */
export function parseHtml(html: string, pageUrl: string): PageData {
  const $ = cheerio.load(html)
  const baseUrl = new URL(pageUrl).origin

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
 * Crawl a single page using Cheerio
 */
export async function crawlPage(url: string): Promise<PageData | null> {
  const html = await fetchHtml(url)
  if (!html) {
    return null
  }

  return parseHtml(html, url)
}

/**
 * Fetch all CSS content for a page
 */
export async function fetchPageCss(pageData: PageData): Promise<string[]> {
  const cssContents: string[] = [...pageData.inlineCss]

  // Fetch external CSS files (in parallel, limit to 10)
  const cssPromises = pageData.cssUrls.slice(0, 10).map(async (url) => {
    const css = await fetchCss(url)
    return css
  })

  const results = await Promise.all(cssPromises)
  for (const css of results) {
    if (css) {
      cssContents.push(css)
    }
  }

  return cssContents
}
