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

/**
 * Extract logo from header/nav area images
 */
function extractFromHeader(pages: PageData[], cache: Map<PageData, Doc>): { url?: string; evidence: Evidence[] } {
  const evidence: Evidence[] = []
  const candidates: Array<{ url: string; score: number; pageUrl: string }> = []

  for (const page of pages) {
    const $ = loadPage(page, cache)
    const seen = new Set<string>()
    $(HEADER_LOGO_SELECTORS.join(', ')).slice(0, 200).each((_, el) => {
      const url = resolveLogoUrl($(el).attr('src'), page.url)
      if (!url || seen.has(url)) return
      seen.add(url)
      candidates.push({ url, score: scoreLogoUrl(url) + 20, pageUrl: page.url }) // Bonus for header/logo context
    })
  }

  // Sort by score and return best
  candidates.sort((a, b) => b.score - a.score)

  if (candidates.length > 0) {
    const best = candidates[0]
    evidence.push({
      url: best.pageUrl,
      snippet: `Logo image: ${best.url}`,
      context: 'Header/nav logo image',
    })
    return { url: best.url, evidence }
  }

  return { evidence }
}

/**
 * Extract favicon as fallback
 */
function extractFavicon(pages: PageData[], cache: Map<PageData, Doc>): { url?: string; evidence: Evidence[] } {
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
      return { url: bestFavicon, evidence }
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
    return {
      logoUrl: undefined, // Don't use favicon as main logo
      faviconUrl: faviconResult.url,
      logoUrls: [],
      confidence: 40,
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
