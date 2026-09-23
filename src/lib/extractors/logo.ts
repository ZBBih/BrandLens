/**
 * Logo extractor - extracts logo URLs from various sources
 *
 * Every candidate is resolved against the page it was found on and must be
 * https (http is upgraded only for the crawled site's own hosts). javascript:,
 * data: and other schemes are rejected. HTML is parsed with cheerio rather
 * than backtracking regexes, so hostile markup stays linear.
 */

import * as cheerio from 'cheerio'
import { PageData } from '../crawler'
import { Evidence } from './types'

export interface LogoData {
  logoUrl?: string
  logoUrls: string[]
  faviconUrl?: string
  confidence: number
  source: 'verified' | 'extracted' | 'inferred'
  evidence: Evidence[]
}

type Doc = ReturnType<typeof cheerio.load>

const MAX_URL_LENGTH = 2048

function stripWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

/**
 * Same site: identical host (ignoring www.) or one is a subdomain of the other
 */
function isSameSite(a: string, b: string): boolean {
  const x = stripWww(a)
  const y = stripWww(b)
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`)
}

/**
 * Resolve a raw logo/favicon reference against its page URL.
 * Returns an absolute https URL, or undefined if it must not be used.
 */
export function resolveLogoUrl(raw: string | undefined | null, pageUrl: string): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return undefined

  let url: URL
  let base: URL
  try {
    base = new URL(pageUrl)
    url = new URL(trimmed, base)
  } catch {
    return undefined
  }

  if (url.username || url.password) return undefined
  if (url.protocol === 'https:') return url.toString()
  if (url.protocol === 'http:' && isSameSite(url.hostname, base.hostname)) {
    url.protocol = 'https:'
    return url.toString()
  }
  // javascript:, data:, blob:, file:, third-party http: ...
  return undefined
}

/**
 * Score a potential logo URL based on path and filename
 */
function scoreLogoUrl(url: string): number {
  const lower = url.toLowerCase()
  let score = 0

  // Strong indicators
  if (lower.includes('logo')) score += 50
  if (lower.includes('brand')) score += 30
  if (lower.includes('icon')) score += 10

  // Format preferences
  if (lower.endsWith('.svg')) score += 30
  if (lower.endsWith('.png')) score += 20
  if (lower.endsWith('.webp')) score += 15

  // Size hints (prefer larger)
  if (/logo[^/]*\d{3,}/.test(lower)) score += 10 // Has 3+ digit number (likely size)
  if (lower.includes('2x') || lower.includes('@2x')) score += 5
  if (lower.includes('full') || lower.includes('large')) score += 10

  // Negative indicators
  if (lower.includes('thumbnail')) score -= 20
  if (lower.includes('favicon') && !lower.includes('logo')) score -= 10
  if (lower.includes('icon-') && !lower.includes('logo')) score -= 10

  return score
}

function loadPage(page: PageData, cache: Map<PageData, Doc>): Doc {
  let $ = cache.get(page)
  if (!$) {
    $ = cheerio.load(page.html || '')
    cache.set(page, $)
  }
  return $
}

/**
 * Extract logo from OpenGraph and meta tags
 */
function extractFromMeta(pages: PageData[], cache: Map<PageData, Doc>): { url?: string; evidence: Evidence[] } {
  const evidence: Evidence[] = []

  for (const page of pages) {
    // Check OpenGraph image
    const ogImage = page.ogData['image']
    if (typeof ogImage === 'string') {
      const resolved = resolveLogoUrl(ogImage, page.url)
      if (resolved) {
        evidence.push({
          url: page.url,
          snippet: `og:image: ${resolved}`,
          context: 'OpenGraph meta tag',
        })

        // High confidence if it looks like a logo
        if (resolved.toLowerCase().includes('logo')) {
          return { url: resolved, evidence }
        }
      }
    }

    // Check for logo meta tag
    const $ = loadPage(page, cache)
    const logoMeta = $('meta[name="logo" i][content]').first().attr('content')
    const resolvedMeta = resolveLogoUrl(logoMeta, page.url)
    if (resolvedMeta) {
      evidence.push({
        url: page.url,
        snippet: `logo meta: ${resolvedMeta}`,
        context: 'Logo meta tag',
      })
      return { url: resolvedMeta, evidence }
    }
  }

  return { evidence }
}

const HEADER_LOGO_SELECTORS = [
  'header img[src]',
  'nav img[src]',
  '[class*="logo" i] img[src]',
  '[id*="logo" i] img[src]',
  'img[class*="logo" i][src]',
  'img[id*="logo" i][src]',
]

/** Images that live in headers but are never the brand logo */
const NOT_A_LOGO = /flag|country|locale|language|avatar|profile|arrow|chevron|caret|close|menu|hamburger|search|sprite|badge|award|payment|visa|mastercard|paypal|app-?store|google-?play|rating|star|cart|user/i
const MIN_HEADER_SCORE = 60
const MAX_INLINE_SVG_BYTES = 40 * 1024

type Element = Parameters<Doc>[0]

/** Words to look for in the element and its three nearest ancestors */
function contextText($: Doc, el: Element): string {
  const parts: string[] = []
  let node = $(el)
  for (let depth = 0; depth < 4 && node.length; depth++) {
    parts.push(node.attr('class') ?? '', node.attr('id') ?? '', node.attr('alt') ?? '', node.attr('aria-label') ?? '', node.attr('title') ?? '')
    node = node.parent()
  }
  return parts.join(' ').toLowerCase()
}

/** True when the element sits inside a link to the site's home page */
function inHomeLink($: Doc, el: Element, pageUrl: string): boolean {
  const href = $(el).closest('a[href]').attr('href')
  if (!href) return false
  try {
    const target = new URL(href, pageUrl)
    const page = new URL(pageUrl)
    return isSameSite(target.hostname, page.hostname) && (target.pathname === '/' || target.pathname === '')
  } catch {
    return false
  }
}

function brandToken(pageUrl: string): string {
  try {
    return stripWww(new URL(pageUrl).hostname).split('.')[0].replace(/[^a-z0-9]/g, '')
  } catch {
    return ''
  }
}

/**
 * How likely an element is to be the brand logo, from where it sits and
 * what it is called rather than only its file name
 */
function contextScore($: Doc, el: Element, url: string, pageUrl: string): number {
  const context = contextText($, el)
  const token = brandToken(pageUrl)
  let score = 0
  if (inHomeLink($, el, pageUrl)) score += 40
  if (context.includes('logo')) score += 40
  if (token.length >= 3 && context.replace(/[^a-z0-9 ]/g, '').includes(token)) score += 30
  if ($(el).closest('header, nav, [role="banner"]').length) score += 10
  if (NOT_A_LOGO.test(url) || NOT_A_LOGO.test(context)) score -= 120
  return score
}

/**
 * Serialise an inline SVG logo to a data URL. Rendered only through <img>,
 * where SVG scripts never run; scripts, handlers and external references are
 * stripped anyway, and oversized markup is refused.
 */
function inlineSvgDataUrl($: Doc, el: Element): string | undefined {
  const svg = $(el).clone()
  svg.find('script, foreignObject, style').remove()
  svg.find('*').addBack().each((_, node) => {
    const attribs = (node as { attribs?: Record<string, string> }).attribs ?? {}
    for (const name of Object.keys(attribs)) {
      const value = attribs[name] ?? ''
      if (/^on/i.test(name) || ((name === 'href' || name === 'xlink:href') && !value.startsWith('#'))) {
        $(node).removeAttr(name)
      }
    }
  })
  if (!svg.attr('xmlns')) svg.attr('xmlns', 'http://www.w3.org/2000/svg')
  const markup = $.html(svg)
  if (!markup || markup.length > MAX_INLINE_SVG_BYTES || !/<(path|rect|circle|polygon|g|text|use)\b/i.test(markup)) return undefined
  return `data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}`
}

/**
 * Extract logo from header/nav area images and inline SVGs
 */
function extractFromHeader(pages: PageData[], cache: Map<PageData, Doc>): { url?: string; evidence: Evidence[] } {
  const evidence: Evidence[] = []
  const candidates: Array<{ url: string; score: number; pageUrl: string; context: string }> = []

  for (const page of pages) {
    const $ = loadPage(page, cache)
    const seen = new Set<string>()
    $(HEADER_LOGO_SELECTORS.join(', ')).slice(0, 200).each((_, el) => {
      const url = resolveLogoUrl($(el).attr('src'), page.url)
      if (!url || seen.has(url)) return
      seen.add(url)
      candidates.push({ url, score: scoreLogoUrl(url) + contextScore($, el, url, page.url), pageUrl: page.url, context: 'Header/nav logo image' })
    })

    // Many modern sites draw the logo as inline SVG inside the home link
    $('header a[href] svg, nav a[href] svg, [class*="logo" i] svg, [id*="logo" i] svg, [role="banner"] a[href] svg').slice(0, 20).each((_, el) => {
      const score = contextScore($, el, '', page.url) + 20 // vector, drawn by the brand itself
      if (score < MIN_HEADER_SCORE) return
      const url = inlineSvgDataUrl($, el)
      if (!url || seen.has(url)) return
      seen.add(url)
      candidates.push({ url, score, pageUrl: page.url, context: 'Inline SVG logo in the header' })
    })
  }

  // Sort by score and return the best candidate that clears the bar
  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  if (best && best.score >= MIN_HEADER_SCORE) {
    evidence.push({
      url: best.pageUrl,
      snippet: best.url.startsWith('data:') ? 'Inline <svg> logo' : `Logo image: ${best.url}`,
      context: best.context,
    })
    return { url: best.url, evidence }
  }

  return { evidence }
}

/**
 * Extract favicon as fallback
 */
function extractFavicon(pages: PageData[], cache: Map<PageData, Doc>): { url?: string; size?: number; evidence: Evidence[] } {
  const evidence: Evidence[] = []

  for (const page of pages) {
    const $ = loadPage(page, cache)
    let bestFavicon: string | undefined
    let bestSize = 0

    $('link[rel][href]').slice(0, 200).each((_, el) => {
      const rel = ($(el).attr('rel') || '').toLowerCase().split(/\s+/)
      if (!rel.includes('icon') && !rel.includes('apple-touch-icon')) return
      const faviconUrl = resolveLogoUrl($(el).attr('href'), page.url)
      if (!faviconUrl) return

      // Prefer larger icons
      const sizeMatch = /(\d+)x\d+/.exec($(el).attr('sizes') || '') || /(\d+)x\d+/.exec(faviconUrl)
      const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 16
      if (size > bestSize || !bestFavicon) {
        bestFavicon = faviconUrl
        bestSize = size
      }
    })

    if (bestFavicon) {
      evidence.push({
        url: page.url,
        snippet: `Favicon: ${bestFavicon}`,
        context: 'Favicon link',
      })
      return { url: bestFavicon, size: bestSize, evidence }
    }
  }

  return { evidence }
}

/**
 * Extract all logo URLs and find the best one
 */
export function extractLogo(pages: PageData[]): LogoData {
  const allEvidence: Evidence[] = []
  const allLogos: string[] = []
  const cache = new Map<PageData, Doc>()

  // Try meta tags first (highest confidence)
  const metaResult = extractFromMeta(pages, cache)
  allEvidence.push(...metaResult.evidence)
  if (metaResult.url) {
    allLogos.push(metaResult.url)
    return {
      logoUrl: metaResult.url,
      logoUrls: allLogos,
      confidence: 90,
      source: 'extracted',
      evidence: allEvidence,
    }
  }

  // Try header/nav images
  const headerResult = extractFromHeader(pages, cache)
  allEvidence.push(...headerResult.evidence)
  if (headerResult.url) {
    allLogos.push(headerResult.url)
    return {
      logoUrl: headerResult.url,
      logoUrls: allLogos,
      confidence: 85,
      source: 'extracted',
      evidence: allEvidence,
    }
  }

  // Fall back to favicon
  const faviconResult = extractFavicon(pages, cache)
  allEvidence.push(...faviconResult.evidence)
  if (faviconResult.url) {
    // A large touch icon is the brand mark drawn for app launchers; a 16px favicon is not a logo
    const usable = (faviconResult.size ?? 0) >= 120
    return {
      logoUrl: usable ? faviconResult.url : undefined,
      faviconUrl: faviconResult.url,
      logoUrls: usable ? [faviconResult.url] : [],
      confidence: usable ? 50 : 40,
      source: 'extracted',
      evidence: allEvidence,
    }
  }

  return {
    logoUrls: [],
    confidence: 0,
    source: 'inferred',
    evidence: [],
  }
}
