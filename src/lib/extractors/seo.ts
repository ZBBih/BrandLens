/**
 * SEO extractor - analyzes SEO health with user-friendly insights
 */

import { PageData } from '../crawler'
import { SeoData, SEOItem, GooglePreview, SocialPreview, Evidence } from './types'

/**
 * Detect title pattern and brand consistency
 */
function analyzeTitles(pages: PageData[]): {
  isConsistent: boolean
  pattern: string
  brandName: string | null
  avgLength: number
} {
  const titles = pages.map(p => p.title).filter(Boolean)

  if (titles.length === 0) {
    return { isConsistent: false, pattern: '', brandName: null, avgLength: 0 }
  }

  // Find common separator
  const separators = ['|', '-', '–', ':', '•', '—']
  let mostCommonSep = '|'
  let maxCount = 0

  for (const sep of separators) {
    const count = titles.filter(t => t.includes(sep)).length
    if (count > maxCount) {
      maxCount = count
      mostCommonSep = sep
    }
  }

  const isConsistent = maxCount >= titles.length * 0.6

  // Extract brand name (usually appears in most titles)
  let brandName: string | null = null
  if (isConsistent) {
    const parts = titles[0].split(mostCommonSep).map(p => p.trim())
    if (parts.length >= 2) {
      // Brand is usually the last part
      const lastPart = parts[parts.length - 1]
      const occurrences = titles.filter(t => t.includes(lastPart)).length
      if (occurrences >= titles.length * 0.5) {
        brandName = lastPart
      }
    }
  }

  const avgLength = Math.round(titles.reduce((sum, t) => sum + t.length, 0) / titles.length)
  const pattern = brandName ? `[Page Name] ${mostCommonSep} ${brandName}` : 'Varies'

  return { isConsistent, pattern, brandName, avgLength }
}

/**
 * Analyze meta descriptions
 */
function analyzeDescriptions(pages: PageData[]): {
  coverage: number
  avgLength: number
  duplicates: string[]
  missing: string[]
} {
  const withDesc = pages.filter(p => p.description && p.description.length > 10)
  const missing = pages.filter(p => !p.description || p.description.length <= 10).map(p => p.url)

  const coverage = Math.round((withDesc.length / pages.length) * 100)
  const avgLength = withDesc.length > 0
    ? Math.round(withDesc.reduce((sum, p) => sum + p.description.length, 0) / withDesc.length)
    : 0

  // Find duplicate descriptions
  const descCounts: Record<string, string[]> = {}
  for (const page of withDesc) {
    const normalized = page.description.toLowerCase().trim().substring(0, 80)
    if (!descCounts[normalized]) {
      descCounts[normalized] = []
    }
    descCounts[normalized].push(page.url)
  }

  const duplicates = Object.values(descCounts)
    .filter(urls => urls.length > 1)
    .flat()

  return { coverage, avgLength, duplicates, missing }
}

/**
 * Analyze H1 tags
 */
function analyzeH1Tags(pages: PageData[]): {
  allHaveH1: boolean
  missingH1: string[]
  multipleH1: string[]
} {
  const missingH1: string[] = []
  const multipleH1: string[] = []

  for (const page of pages) {
    const h1s = page.headings.filter(h => h.level === 1)
    if (h1s.length === 0) {
      missingH1.push(page.url)
    } else if (h1s.length > 1) {
      multipleH1.push(page.url)
    }
  }

  return {
    allHaveH1: missingH1.length === 0,
    missingH1,
    multipleH1,
  }
}

/**
 * Extract Schema.org types
 */
function extractSchemaTypes(pages: PageData[]): string[] {
  const types = new Set<string>()

  for (const page of pages) {
    for (const schema of page.schemaData) {
      const type = (schema as Record<string, unknown>)['@type']
      if (typeof type === 'string') {
        types.add(type)
      } else if (Array.isArray(type)) {
        type.forEach(t => typeof t === 'string' && types.add(t))
      }
    }
  }

  return Array.from(types)
}

/**
 * Check for canonical tags
 */
function hasCanonicalTags(pages: PageData[]): boolean {
  return pages.some(p =>
    p.html.includes('rel="canonical"') || p.html.includes("rel='canonical'")
  )
}

/**
 * Check if site has local signals (address, phone)
 */
function hasLocalSignals(pages: PageData[]): boolean {
  for (const page of pages) {
    // Check for address patterns
    const addressPattern = /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[,\s]+[\w\s]+,\s*[A-Z]{2}\s*\d{5}/i
    if (addressPattern.test(page.html)) return true

    // Check for phone patterns
    const phonePattern = /(?:\+1[- ]?)?\(?[2-9]\d{2}\)?[- ]?\d{3}[- ]?\d{4}/
    if (phonePattern.test(page.html)) return true
  }
  return false
}

/**
 * Calculate SEO score based on wins and issues
 */
function calculateScore(wins: SEOItem[], issues: SEOItem[]): number {
  let score = 10

  for (const issue of issues) {
    if (issue.status === 'bad') score -= 2
    else if (issue.status === 'warning') score -= 1
  }

  return Math.max(0, Math.min(10, score))
}

/**
 * Get path from URL for display
 */
function getPath(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname === '/' ? '/' : u.pathname
  } catch {
    return url
  }
}

/**
 * Extract SEO data from crawled pages
 */
export function extractSeo(pages: PageData[]): SeoData {
  const evidence: Evidence[] = []
  const wins: SEOItem[] = []
  const issues: SEOItem[] = []

  // Find homepage
  const homepage = pages.find(p => {
    try {
      const url = new URL(p.url)
      return url.pathname === '/' || url.pathname === ''
    } catch {
      return false
    }
  }) || pages[0]

  // Analyze titles
  const titleAnalysis = analyzeTitles(pages)

  if (titleAnalysis.isConsistent) {
    wins.push({
      type: 'title',
      status: 'good',
      headline: 'Page titles are consistent',
      detail: `Your titles follow the pattern: "${titleAnalysis.pattern}". This helps with brand recognition in search results.`,
    })
  } else if (pages.length > 1) {
    issues.push({
      type: 'title',
      status: 'warning',
      headline: 'Page titles are inconsistent',
      detail: "Your page titles don't follow a consistent pattern. Consistent titles help users recognize your brand.",
      action: 'Use a consistent format like "Page Name | Brand Name" across all pages.',
    })
  }

  // Title length check
  if (titleAnalysis.avgLength >= 50 && titleAnalysis.avgLength <= 60) {
    wins.push({
      type: 'title',
      status: 'good',
      headline: 'Good title length',
      detail: `Average title length is ${titleAnalysis.avgLength} characters, which displays well in search results.`,
    })
  } else if (titleAnalysis.avgLength > 70) {
    issues.push({
      type: 'title',
      status: 'warning',
      headline: 'Titles may be too long',
      detail: `Average title length is ${titleAnalysis.avgLength} characters. Google typically shows 50-60 characters.`,
      action: 'Shorten titles to under 60 characters to prevent truncation.',
    })
  }

  // Analyze descriptions
  const descAnalysis = analyzeDescriptions(pages)

  if (descAnalysis.coverage === 100) {
    wins.push({
      type: 'description',
      status: 'good',
      headline: `All ${pages.length} pages have meta descriptions`,
      detail: 'Every page tells Google what it\'s about.',
    })
  } else if (descAnalysis.missing.length > 0) {
    issues.push({
      type: 'description',
      status: 'bad',
      headline: `${descAnalysis.missing.length} page${descAnalysis.missing.length > 1 ? 's' : ''} missing meta descriptions`,
      detail: 'Pages without descriptions may show random text snippets in Google results.',
      action: 'Write a unique 150-160 character description for each page.',
      affectedPages: descAnalysis.missing.map(getPath),
    })
  }

  if (descAnalysis.duplicates.length > 2) {
    issues.push({
      type: 'description',
      status: 'warning',
      headline: `Meta descriptions are too similar (${descAnalysis.duplicates.length} pages)`,
      detail: 'Many pages share nearly identical descriptions. Google prefers unique descriptions.',
      action: 'Write a unique description for each page describing its specific content.',
      affectedPages: descAnalysis.duplicates.map(getPath),
    })
  }

  // Description length
  if (descAnalysis.avgLength >= 120 && descAnalysis.avgLength <= 160) {
    wins.push({
      type: 'description',
      status: 'good',
      headline: 'Good description length',
      detail: `Average description length is ${descAnalysis.avgLength} characters, perfect for search results.`,
    })
  }

  // Analyze H1 tags
  const h1Analysis = analyzeH1Tags(pages)

  if (h1Analysis.allHaveH1 && h1Analysis.multipleH1.length === 0) {
    wins.push({
      type: 'h1',
      status: 'good',
      headline: 'All pages have exactly one H1',
      detail: 'Each page has a clear main headline for Google (best practice).',
    })
  } else {
    if (h1Analysis.missingH1.length > 0) {
      issues.push({
        type: 'h1',
        status: 'bad',
        headline: `${h1Analysis.missingH1.length} page${h1Analysis.missingH1.length > 1 ? 's' : ''} missing H1 headline`,
        detail: 'The main headline (H1) tells Google what the page is about.',
        action: 'Add exactly one H1 tag to each page.',
        affectedPages: h1Analysis.missingH1.map(getPath),
      })
    }
    if (h1Analysis.multipleH1.length > 0) {
      issues.push({
        type: 'h1',
        status: 'warning',
        headline: `${h1Analysis.multipleH1.length} page${h1Analysis.multipleH1.length > 1 ? 's have' : ' has'} multiple H1s`,
        detail: 'Pages should have exactly one H1. Multiple H1s can confuse search engines.',
        action: 'Use only one H1 per page. Use H2-H6 for subheadings.',
        affectedPages: h1Analysis.multipleH1.map(getPath),
      })
    }
  }

  // Analyze Schema
  const schemaTypes = extractSchemaTypes(pages)

  if (schemaTypes.includes('FAQPage')) {
    wins.push({
      type: 'schema',
      status: 'good',
      headline: 'FAQ pages have rich snippet support',
      detail: 'Google can show expandable Q&A directly in search results, increasing click-through rate.',
    })
  }

  if (schemaTypes.includes('LocalBusiness') || schemaTypes.includes('Organization')) {
    wins.push({
      type: 'schema',
      status: 'good',
      headline: 'Business info is structured for Google',
      detail: 'Search engines can display your business details in rich results.',
    })
  } else if (hasLocalSignals(pages)) {
    issues.push({
      type: 'schema',
      status: 'warning',
      headline: 'Missing LocalBusiness schema',
      detail: 'You have address/phone info but it\'s not marked up for Google. This helps with "near me" searches.',
      action: 'Add LocalBusiness structured data with your address, phone, and hours.',
    })
  }

  if (schemaTypes.includes('Product') || schemaTypes.includes('Offer')) {
    wins.push({
      type: 'schema',
      status: 'good',
      headline: 'Products have rich snippet support',
      detail: 'Google can show prices and ratings directly in search results.',
    })
  }

  // Check canonical
  const hasCanonical = hasCanonicalTags(pages)
  if (hasCanonical) {
    wins.push({
      type: 'canonical',
      status: 'good',
      headline: 'Canonical tags are in place',
      detail: 'Pages specify their preferred URL, preventing duplicate content issues.',
    })
  }

  // Check OpenGraph
  const ogImage = homepage?.ogData?.['og:image'] || null
  const ogTitle = homepage?.ogData?.['og:title'] || homepage?.title || ''
  const ogDescription = homepage?.ogData?.['og:description'] || homepage?.description || ''
  const ogSiteName = homepage?.ogData?.['og:site_name'] || ''

  if (ogImage) {
    wins.push({
      type: 'og',
      status: 'good',
      headline: 'Social sharing image is set',
      detail: 'Your site will look great when shared on Facebook, LinkedIn, and Twitter.',
    })
  } else {
    issues.push({
      type: 'og',
      status: 'warning',
      headline: 'No social sharing image',
      detail: 'When someone shares your site on social media, it will appear without an image.',
      action: 'Add an og:image tag with a 1200x630 pixel image.',
    })
  }

  // Calculate score
  const score = calculateScore(wins, issues)

  // Ensure minimum of 3 insights total (wins + issues)
  const totalInsights = wins.length + issues.length
  if (totalInsights < 3) {
    const defaultRecommendations: SEOItem[] = []

    // Check what's missing and add relevant recommendations
    const hasSpeedRecommendation = issues.some(i => i.headline.toLowerCase().includes('speed') || i.headline.toLowerCase().includes('performance'))
    const hasMobileRecommendation = issues.some(i => i.headline.toLowerCase().includes('mobile'))
    const hasInternalLinksRecommendation = issues.some(i => i.headline.toLowerCase().includes('internal link'))
    const hasAltTextRecommendation = issues.some(i => i.headline.toLowerCase().includes('alt') || i.headline.toLowerCase().includes('image'))
    const hasSitemapRecommendation = issues.some(i => i.headline.toLowerCase().includes('sitemap'))

    if (!hasSpeedRecommendation) {
      defaultRecommendations.push({
        type: 'title',
        status: 'warning',
        headline: 'Consider page speed optimization',
        detail: 'Fast-loading pages rank better and provide a better user experience.',
        action: 'Use tools like Google PageSpeed Insights to identify performance improvements.',
      })
    }

    if (!hasMobileRecommendation) {
      defaultRecommendations.push({
        type: 'title',
        status: 'warning',
        headline: 'Ensure mobile-friendliness',
        detail: 'Over 60% of searches happen on mobile devices. Google uses mobile-first indexing.',
        action: 'Test your site with Google\'s Mobile-Friendly Test tool.',
      })
    }

    if (!hasInternalLinksRecommendation) {
      defaultRecommendations.push({
        type: 'title',
        status: 'warning',
        headline: 'Review internal linking structure',
        detail: 'Internal links help search engines discover and understand your content hierarchy.',
        action: 'Ensure important pages are linked from your navigation and related content.',
      })
    }

    if (!hasAltTextRecommendation) {
      defaultRecommendations.push({
        type: 'title',
        status: 'warning',
        headline: 'Add alt text to images',
        detail: 'Alt text helps search engines understand images and improves accessibility.',
        action: 'Add descriptive alt attributes to all meaningful images.',
      })
    }

    if (!hasSitemapRecommendation) {
      defaultRecommendations.push({
        type: 'title',
        status: 'warning',
        headline: 'Submit XML sitemap',
        detail: 'A sitemap helps search engines discover and index all your pages.',
        action: 'Create and submit an XML sitemap to Google Search Console.',
      })
    }

    // Add enough default recommendations to reach 3 total
    const needed = 3 - totalInsights
    issues.push(...defaultRecommendations.slice(0, needed))
  }

  // Build evidence
  if (homepage?.title) {
    evidence.push({
      url: homepage.url,
      snippet: `Title: ${homepage.title}`,
      context: 'Homepage title',
    })
  }
  if (homepage?.description) {
    evidence.push({
      url: homepage.url,
      snippet: `Description: ${homepage.description.slice(0, 100)}...`,
      context: 'Homepage meta description',
    })
  }

  // Google Preview
  const googlePreview: GooglePreview = {
    title: homepage?.title || 'No title found',
    url: homepage?.url || '',
    description: homepage?.description || 'No meta description found.',
  }

  // Social Preview
  let siteName = ogSiteName
  if (!siteName) {
    try {
      siteName = new URL(homepage?.url || '').hostname.replace('www.', '')
    } catch {
      siteName = 'Unknown'
    }
  }

  const socialPreview: SocialPreview = {
    title: ogTitle || homepage?.title || 'No title',
    description: ogDescription || 'No description',
    image: ogImage,
    siteName,
  }

  // Legacy patterns for backwards compatibility
  const titlePatterns = titleAnalysis.isConsistent
    ? [`Uses "${titleAnalysis.pattern}" pattern`]
    : ['Title format varies']

  const descriptionPatterns = [
    `Coverage: ${descAnalysis.coverage}%`,
    descAnalysis.avgLength > 0 ? `Avg length: ${descAnalysis.avgLength} chars` : 'No descriptions',
  ]

  const h1Patterns = h1Analysis.allHaveH1
    ? ['All pages have H1 tags']
    : [`${h1Analysis.missingH1.length} pages missing H1`]

  // Calculate confidence
  let confidence = 60
  if (wins.length > 0) confidence += wins.length * 5
  if (issues.length > 0) confidence -= issues.length * 3
  confidence = Math.max(30, Math.min(95, confidence))

  return {
    score,
    wins,
    issues,
    googlePreview,
    socialPreview,
    titlePattern: titleAnalysis.pattern,
    hasCanonical,
    schemaTypes,
    schemas: pages.flatMap(p => p.schemaData),
    // Legacy
    titlePatterns,
    descriptionPatterns,
    h1Patterns,
    confidence,
    source: 'extracted',
    evidence: evidence.slice(0, 20),
  }
}
