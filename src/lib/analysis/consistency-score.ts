/**
 * Brand Consistency Score Calculator
 * Analyzes consistency across all crawled pages
 */

import { PageData } from '../crawler'
import { ConsistencyData, ConsistencyBreakdown, ColorEntry, FontEntry, ToneData } from '../extractors/types'
import { analyzeToneVoice } from './tone-voice'

interface PageAnalysis {
  url: string
  colors: Set<string>
  fonts: Set<string>
  title: string
  description: string
  h1: string[]
  keyPhrases: string[]
}

/**
 * Extract colors from a single page's CSS
 */
function extractPageColors(html: string, css: string): Set<string> {
  const colors = new Set<string>()

  // Match hex colors
  const hexRegex = /#([0-9a-fA-F]{3,8})\b/g
  let match
  while ((match = hexRegex.exec(css)) !== null) {
    const hex = match[0].toLowerCase()
    // Normalize 3-char to 6-char
    if (hex.length === 4) {
      const expanded = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      colors.add(expanded)
    } else if (hex.length === 7) {
      colors.add(hex)
    }
  }

  // Match rgb colors and convert
  const rgbRegex = /rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/gi
  while ((match = rgbRegex.exec(css)) !== null) {
    const r = parseInt(match[1], 10)
    const g = parseInt(match[2], 10)
    const b = parseInt(match[3], 10)
    const hex = '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
    colors.add(hex.toLowerCase())
  }

  return colors
}

/**
 * Extract fonts from a single page's CSS
 */
function extractPageFonts(css: string): Set<string> {
  const fonts = new Set<string>()
  const fontRegex = /font-family\s*:\s*([^;}]+)/gi

  let match
  while ((match = fontRegex.exec(css)) !== null) {
    const fontStack = match[1].trim()
    // Get first font in stack
    const firstFont = fontStack.split(',')[0].trim().replace(/['"`]/g, '').toLowerCase()
    if (firstFont && !['inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace'].includes(firstFont)) {
      fonts.add(firstFont)
    }
  }

  return fonts
}

/**
 * Extract key phrases from page content
 */
function extractKeyPhrases(page: PageData): string[] {
  const phrases: string[] = []

  // Get tagline-like content
  const h1s = page.headings.filter(h => h.level === 1).map(h => h.text.toLowerCase())
  phrases.push(...h1s)

  // Get description
  if (page.description) {
    phrases.push(page.description.toLowerCase())
  }

  // Get CTA text
  phrases.push(...page.ctaButtons.map(c => c.toLowerCase()))

  return phrases
}

/**
 * Analyze a single page
 */
function analyzePage(page: PageData, cssContent: string): PageAnalysis {
  return {
    url: page.url,
    colors: extractPageColors(page.html, cssContent),
    fonts: extractPageFonts(cssContent),
    title: page.title || '',
    description: page.description || '',
    h1: page.headings.filter(h => h.level === 1).map(h => h.text),
    keyPhrases: extractKeyPhrases(page),
  }
}

/**
 * Calculate color consistency score (0-25)
 */
function calculateColorScore(
  pageAnalyses: PageAnalysis[],
  brandColors: ColorEntry[],
  issues: string[]
): number {
  if (pageAnalyses.length === 0 || brandColors.length === 0) return 25

  const primaryColor = brandColors.find(c => c.role === 'primary')?.hex.toLowerCase()
  const secondaryColor = brandColors.find(c => c.role === 'secondary')?.hex.toLowerCase()
  const brandColorSet = new Set(brandColors.map(c => c.hex.toLowerCase()))

  let pagesWithBrandColors = 0
  let offBrandColorCount = 0

  for (const page of pageAnalyses) {
    const hasP = primaryColor && page.colors.has(primaryColor)
    const hasS = secondaryColor && page.colors.has(secondaryColor)

    if (hasP || hasS) {
      pagesWithBrandColors++
    }

    // Count off-brand colors
    for (const color of page.colors) {
      if (!brandColorSet.has(color) && !isNeutralColor(color)) {
        offBrandColorCount++
      }
    }
  }

  const consistency = pagesWithBrandColors / pageAnalyses.length
  let score = Math.round(25 * consistency)

  // Penalize off-brand colors
  if (offBrandColorCount > 5) {
    score = Math.max(0, score - 5)
    issues.push(`Found ${offBrandColorCount} off-brand colors across pages`)
  }

  if (consistency < 0.8) {
    issues.push(`Only ${Math.round(consistency * 100)}% of pages use brand colors`)
  }

  return score
}

/**
 * Check if color is neutral (black, white, gray)
 */
function isNeutralColor(hex: string): boolean {
  const h = hex.replace('#', '')
  if (h.length !== 6) return false

  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)

  // Check if near grayscale
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)

  return max - min < 30
}

/**
 * Calculate typography consistency score (0-20)
 */
function calculateTypographyScore(
  pageAnalyses: PageAnalysis[],
  brandFonts: FontEntry[],
  issues: string[]
): number {
  if (pageAnalyses.length === 0 || brandFonts.length === 0) return 20

  const primaryFont = brandFonts[0]?.name.toLowerCase()
  const brandFontSet = new Set(brandFonts.map(f => f.name.toLowerCase()))

  let pagesWithCorrectFonts = 0

  for (const page of pageAnalyses) {
    const hasCorrectFont = primaryFont && page.fonts.has(primaryFont)

    if (hasCorrectFont || page.fonts.size === 0) {
      pagesWithCorrectFonts++
    }

    // Check for random fonts
    for (const font of page.fonts) {
      if (!brandFontSet.has(font) && !isSystemFont(font)) {
        issues.push(`Page ${new URL(page.url).pathname} uses non-brand font: ${font}`)
        break
      }
    }
  }

  const consistency = pagesWithCorrectFonts / pageAnalyses.length

  if (consistency < 0.9) {
    issues.push(`Font consistency at ${Math.round(consistency * 100)}%`)
  }

  return Math.round(20 * consistency)
}

/**
 * Check if font is a system font
 */
function isSystemFont(font: string): boolean {
  const systemFonts = [
    'arial', 'helvetica', 'verdana', 'georgia', 'times', 'times new roman',
    'courier', 'courier new', 'system-ui', '-apple-system', 'segoe ui',
    'roboto', 'helvetica neue'
  ]
  return systemFonts.includes(font.toLowerCase())
}

/**
 * Calculate tone consistency score (0-25)
 */
async function calculateToneScore(
  pages: PageData[],
  mainTone: ToneData,
  issues: string[]
): Promise<number> {
  if (pages.length < 2) return 25

  // Compare traits across page types
  const mainTraits = new Set(mainTone.traits.map(t => t.toLowerCase()))

  // Simple heuristic: check if key pages have similar content style
  const homePage = pages.find(p => new URL(p.url).pathname === '/' || p.url.endsWith('.com') || p.url.endsWith('.com/'))
  const aboutPage = pages.find(p => /about|company|story/i.test(p.url))
  const blogPage = pages.find(p => /blog|news|article/i.test(p.url))

  let consistentPages = 0
  let totalChecked = 0

  // Check if content style is consistent by analyzing sentence patterns
  for (const page of [homePage, aboutPage, blogPage].filter(Boolean)) {
    if (!page) continue
    totalChecked++

    // Simple check: are CTAs and headings in similar style?
    const hasExclamations = page.ctaButtons.some(c => c.includes('!'))
    const hasEmojis = page.ctaButtons.some(c => /[\u{1F300}-\u{1F9FF}]/u.test(c))
    const hasUrgency = page.ctaButtons.some(c => /now|today|limited|hurry/i.test(c))

    // If main tone is casual, expect some of these
    const isCasualMain = mainTraits.has('casual') || mainTraits.has('playful') || mainTraits.has('friendly')
    const isCasualPage = hasExclamations || hasEmojis

    if ((isCasualMain && isCasualPage) || (!isCasualMain && !isCasualPage)) {
      consistentPages++
    }
  }

  if (totalChecked === 0) return 25

  const consistency = consistentPages / totalChecked

  if (consistency < 0.8 && blogPage) {
    issues.push('Blog/news section may have different tone than main site')
  }

  // Weight towards higher scores since tone analysis is imprecise
  return Math.round(25 * Math.max(0.6, consistency))
}

/**
 * Calculate SEO consistency score (0-15)
 */
function calculateSeoScore(
  pageAnalyses: PageAnalysis[],
  issues: string[]
): number {
  if (pageAnalyses.length < 2) return 15

  let score = 15

  // Check title pattern consistency
  const titles = pageAnalyses.map(p => p.title).filter(Boolean)
  if (titles.length > 1) {
    // Check if titles follow a pattern (e.g., "Page | Brand" or "Brand - Page")
    const separators = titles.map(t => {
      if (t.includes(' | ')) return '|'
      if (t.includes(' - ')) return '-'
      if (t.includes(' — ')) return '—'
      return null
    })

    const uniqueSeparators = new Set(separators.filter(Boolean))
    if (uniqueSeparators.size > 1) {
      score -= 3
      issues.push('Title tags use inconsistent separators')
    }
  }

  // Check description length consistency
  const descriptions = pageAnalyses.map(p => p.description).filter(Boolean)
  if (descriptions.length > 1) {
    const lengths = descriptions.map(d => d.length)
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
    const variance = lengths.map(l => Math.abs(l - avgLength)).reduce((a, b) => a + b, 0) / lengths.length

    if (variance > 50) {
      score -= 2
      issues.push('Meta description lengths vary significantly')
    }
  }

  // Check H1 usage
  const pagesWithH1 = pageAnalyses.filter(p => p.h1.length > 0).length
  const h1Coverage = pagesWithH1 / pageAnalyses.length

  if (h1Coverage < 0.8) {
    score -= 3
    issues.push(`Only ${Math.round(h1Coverage * 100)}% of pages have H1 tags`)
  }

  // Check for duplicate H1s (bad)
  const allH1s = pageAnalyses.flatMap(p => p.h1)
  const uniqueH1s = new Set(allH1s)
  if (allH1s.length > uniqueH1s.size + 1) {
    score -= 2
    issues.push('Multiple pages share the same H1 heading')
  }

  return Math.max(0, score)
}

/**
 * Calculate message consistency score (0-15)
 */
function calculateMessageScore(
  pageAnalyses: PageAnalysis[],
  issues: string[]
): number {
  if (pageAnalyses.length < 2) return 15

  // Get key phrases from homepage
  const homepage = pageAnalyses.find(p => {
    const pathname = new URL(p.url).pathname
    return pathname === '/' || pathname === ''
  }) || pageAnalyses[0]

  const coreMessages = homepage.keyPhrases.filter(p => p.length > 10)

  if (coreMessages.length === 0) return 15

  // Check how many other pages reference core messages
  let messageHits = 0
  let totalChecks = 0

  for (const page of pageAnalyses) {
    if (page.url === homepage.url) continue
    totalChecks++

    const pageContent = [...page.keyPhrases, page.title, page.description].join(' ').toLowerCase()

    for (const coreMsg of coreMessages.slice(0, 3)) {
      // Check for key words from core message
      const words = coreMsg.split(/\s+/).filter(w => w.length > 4)
      const matchCount = words.filter(w => pageContent.includes(w)).length

      if (matchCount >= words.length * 0.3) {
        messageHits++
        break
      }
    }
  }

  if (totalChecks === 0) return 15

  const consistency = messageHits / totalChecks

  if (consistency < 0.5) {
    issues.push('Core messaging not reinforced across pages')
  }

  return Math.round(15 * Math.max(0.5, consistency))
}

/**
 * Calculate letter grade from score
 */
function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * Main function to calculate brand consistency score
 */
export async function calculateConsistencyScore(
  pages: PageData[],
  cssContents: Map<string, string[]>,
  brandColors: ColorEntry[],
  brandFonts: FontEntry[],
  mainTone: ToneData
): Promise<ConsistencyData> {
  const issues: string[] = []

  // Analyze each page
  const pageAnalyses: PageAnalysis[] = []
  for (const page of pages) {
    const pageCss = cssContents.get(page.url)?.join('\n') || ''
    pageAnalyses.push(analyzePage(page, pageCss))
  }

  // Calculate individual scores
  const colorScore = calculateColorScore(pageAnalyses, brandColors, issues)
  const typographyScore = calculateTypographyScore(pageAnalyses, brandFonts, issues)
  const toneScore = await calculateToneScore(pages, mainTone, issues)
  const seoScore = calculateSeoScore(pageAnalyses, issues)
  const messageScore = calculateMessageScore(pageAnalyses, issues)

  const breakdown: ConsistencyBreakdown = {
    color: colorScore,
    typography: typographyScore,
    tone: toneScore,
    seo: seoScore,
    message: messageScore,
  }

  const totalScore = colorScore + typographyScore + toneScore + seoScore + messageScore

  return {
    score: totalScore,
    grade: getGrade(totalScore),
    breakdown,
    issues: issues.slice(0, 10), // Limit to top 10 issues
  }
}
