/**
 * Logo extractor - extracts logo URLs from various sources
 */

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
  if (/logo.*\d{3,}/.test(lower)) score += 10 // Has 3+ digit number (likely size)
  if (lower.includes('2x') || lower.includes('@2x')) score += 5
  if (lower.includes('full') || lower.includes('large')) score += 10

  // Negative indicators
  if (lower.includes('thumbnail')) score -= 20
  if (lower.includes('favicon') && !lower.includes('logo')) score -= 10
  if (lower.includes('icon-') && !lower.includes('logo')) score -= 10

  return score
}

/**
 * Extract logo from OpenGraph and meta tags
 */
function extractFromMeta(pages: PageData[]): { url?: string; evidence: Evidence[] } {
  const evidence: Evidence[] = []

  for (const page of pages) {
    // Check OpenGraph image
    if (page.ogData['image']) {
      const ogImage = page.ogData['image']
      if (typeof ogImage === 'string') {
        evidence.push({
          url: page.url,
          snippet: `og:image: ${ogImage}`,
          context: 'OpenGraph meta tag',
        })

        // High confidence if it looks like a logo
        if (ogImage.toLowerCase().includes('logo')) {
          return { url: ogImage, evidence }
        }
      }
    }

    // Check for logo meta tag
    const logoMeta = page.html.match(/<meta[^>]+name=["']?logo["']?[^>]+content=["']([^"']+)["']/i)
    if (logoMeta) {
      evidence.push({
        url: page.url,
        snippet: `logo meta: ${logoMeta[1]}`,
        context: 'Logo meta tag',
      })
      return { url: logoMeta[1], evidence }
    }
  }

  return { evidence }
}

/**
 * Extract logo from header/nav area images
 */
function extractFromHeader(pages: PageData[]): { url?: string; evidence: Evidence[] } {
  const evidence: Evidence[] = []
  const candidates: Array<{ url: string; score: number; pageUrl: string }> = []

  for (const page of pages) {
    // Look for images in header/nav with logo indicators
    const headerLogoPatterns = [
      /<header[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      /<nav[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      /<[^>]+class=["'][^"']*logo[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi,
      /<img[^>]+class=["'][^"']*logo[^"']*["'][^>]+src=["']([^"']+)["']/gi,
      /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*logo[^"']*["']/gi,
      /<a[^>]+class=["'][^"']*logo[^"']*["'][^>]*href=["']\/["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/gi,
    ]

    for (const pattern of headerLogoPatterns) {
      let match
      while ((match = pattern.exec(page.html)) !== null) {
        const imgUrl = match[1]
        if (imgUrl && !imgUrl.startsWith('data:')) {
          const score = scoreLogoUrl(imgUrl) + 20 // Bonus for being in header/logo class
          candidates.push({ url: imgUrl, score, pageUrl: page.url })
        }
      }
    }
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
function extractFavicon(pages: PageData[]): { url?: string; evidence: Evidence[] } {
  const evidence: Evidence[] = []

  for (const page of pages) {
    // Look for favicon links
    const faviconPatterns = [
      /<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/gi,
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["']/gi,
    ]

    let bestFavicon: string | undefined
    let bestSize = 0

    for (const pattern of faviconPatterns) {
      let match
      while ((match = pattern.exec(page.html)) !== null) {
        const faviconUrl = match[1]
        if (faviconUrl) {
          // Prefer larger icons
          const sizeMatch = faviconUrl.match(/(\d+)x\d+/) || faviconUrl.match(/sizes=["'](\d+)/)
          const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 16

          if (size > bestSize || !bestFavicon) {
            bestFavicon = faviconUrl
            bestSize = size
          }
        }
      }
    }

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

  // Try meta tags first (highest confidence)
  const metaResult = extractFromMeta(pages)
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
  const headerResult = extractFromHeader(pages)
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
  const faviconResult = extractFavicon(pages)
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
