/**
 * Brand Consistency Score Calculator
 * Analyzes consistency across all crawled pages.
 *
 * Each dimension is either scored or reported as 'insufficient_data'; missing
 * data never earns full marks (G7). The total is the scored dimensions scaled
 * to 100 over their combined maximum, and a letter grade is only given when
 * at least 3 pages were crawled and at least 3 dimensions could be scored.
 */

import type { PageData } from '../crawler'
import type {
  ConsistencyData,
  ConsistencyBreakdown,
  ConsistencyDimension,
  ConsistencyGrade,
  DimensionScore,
  ColorEntry,
  FontEntry,
  ToneData,
} from '../extractors/types'
import {
  classifyColorProperty,
  collectCssVariables,
  colorDifference,
  createVarResolver,
  extractColorsFromValue,
  extractInlineStyleDeclarations,
  isNeutralColor,
  walkCssDeclarations,
} from '../extractors/colors'
import type { VarResolver } from '../extractors/colors'
import { CONSISTENCY_DIMENSIONS, CONSISTENCY_MAX } from '../export/consistency'

export { normalizeConsistencyData } from '../export/consistency'

/** Minimum crawled pages for a letter grade */
export const MIN_PAGES_FOR_GRADE = 3
/** Minimum scored dimensions for a letter grade */
export const MIN_DIMENSIONS_FOR_GRADE = 3

const MAX = CONSISTENCY_MAX
const DIMENSIONS = CONSISTENCY_DIMENSIONS

type PageWithAreas = PageData & { colorAreas?: Record<string, number> }

interface PageAnalysis {
  url: string
  colors: Set<string>
  fonts: Set<string>
  title: string
  description: string
  h1: string[]
  keyPhrases: string[]
}

const GENERIC_FONTS = new Set([
  'inherit', 'initial', 'unset', 'revert', 'sans-serif', 'serif', 'monospace',
  'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
  '-apple-system', 'blinkmacsystemfont',
])

function scored(dimension: ConsistencyDimension, score: number): DimensionScore {
  const max = MAX[dimension]
  return { score: Math.max(0, Math.min(max, Math.round(score))), max, status: 'scored' }
}

function insufficient(dimension: ConsistencyDimension, reason: string): DimensionScore {
  return { score: null, max: MAX[dimension], status: 'insufficient_data', reason }
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return ''
  }
}

function normalizeFontName(name: string): string {
  return name.replace(/['"`]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

/**
 * Extract colors used by a page: every color syntax in its CSS plus
 * inline style="" attributes. Returns lowercase '#rrggbb' values.
 */
export function extractPageColors(html: string, css: string, resolve?: VarResolver): Set<string> {
  const colors = new Set<string>()
  const record = (property: string, value: string) => {
    if (!classifyColorProperty(property)) return
    for (const hex of extractColorsFromValue(value, resolve)) colors.add(hex)
  }
  walkCssDeclarations(css, d => record(d.property, d.value))
  for (const d of extractInlineStyleDeclarations(html)) record(d.property, d.value)
  return colors
}

/**
 * Extract the primary font of every font-family declaration in a page's CSS.
 * var() references are resolved from the collected custom properties;
 * anything still unresolved is ignored rather than counted as a font.
 */
export function extractPageFonts(css: string, resolve?: VarResolver): Set<string> {
  const fonts = new Set<string>()
  walkCssDeclarations(css, ({ property, value }) => {
    if (property !== 'font-family' && property !== 'font') return
    let stack = value.replace(/!important/gi, '')
    if (stack.includes('var(')) {
      if (!resolve) return
      stack = resolve(stack)
    }
    if (stack.includes('var(') || stack.includes('__unresolved__')) return
    if (property === 'font') {
      // font shorthand: family list comes last, after the size
      const m = /\d[\w.%]*(?:\s*\/\s*[\w.%]+)?\s+([^\d\s].*)$/.exec(stack.slice(0, 500))
      if (!m) return
      stack = m[1]
    }
    const first = normalizeFontName(stack.split(',')[0] ?? '')
    if (first && !GENERIC_FONTS.has(first)) fonts.add(first)
  })
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
function analyzePage(
  page: PageData,
  cssContent: string,
  resolve: VarResolver,
  cache: Map<string, { colors: Set<string>; fonts: Set<string> }>
): PageAnalysis {
  let cssResult = cache.get(cssContent)
  if (!cssResult) {
    cssResult = {
      colors: extractPageColors('', cssContent, resolve),
      fonts: extractPageFonts(cssContent, resolve),
    }
    cache.set(cssContent, cssResult)
  }
  const colors = new Set(cssResult.colors)
  for (const hex of extractPageColors(page.html || '', '', resolve)) colors.add(hex)
  for (const hex of Object.keys((page as PageWithAreas).colorAreas ?? {})) colors.add(hex.toLowerCase())

  const fonts = new Set(cssResult.fonts)
  for (const info of Object.values(page.computedFonts ?? {})) {
    const first = normalizeFontName(info.fontFamily.split(',')[0] ?? '')
    if (first && !first.includes('var(') && !GENERIC_FONTS.has(first)) fonts.add(first)
  }

  return {
    url: page.url,
    colors,
    fonts,
    title: page.title || '',
    description: page.description || '',
    h1: page.headings.filter(h => h.level === 1).map(h => h.text),
    keyPhrases: extractKeyPhrases(page),
  }
}

function hasNearColor(colors: Set<string>, target: string): boolean {
  if (colors.has(target)) return true
  for (const c of colors) {
    if (colorDifference(c, target) < 3) return true
  }
  return false
}

/**
 * Calculate color consistency score (0-25)
 */
function calculateColorScore(
  pageAnalyses: PageAnalysis[],
  brandColors: ColorEntry[],
  issues: string[]
): DimensionScore {
  const primaryColor = brandColors.find(c => c.role === 'primary')?.hex.toLowerCase()
  const secondaryColor = brandColors.find(c => c.role === 'secondary')?.hex.toLowerCase()
  if (!primaryColor && !secondaryColor) {
    return insufficient('color', 'no brand colors were extracted')
  }

  const pagesWithColorData = pageAnalyses.filter(p => p.colors.size > 0)
  if (pagesWithColorData.length === 0) {
    return insufficient('color', 'no color usage was found on the crawled pages')
  }

  const brandColorList = brandColors.map(c => c.hex.toLowerCase())
  let pagesWithBrandColors = 0
  const offBrand = new Set<string>()

  for (const page of pagesWithColorData) {
    const hasP = primaryColor !== undefined && hasNearColor(page.colors, primaryColor)
    const hasS = secondaryColor !== undefined && hasNearColor(page.colors, secondaryColor)
    if (hasP || hasS) pagesWithBrandColors++

    for (const color of page.colors) {
      if (isNeutralColor(color)) continue
      if (brandColorList.some(b => b === color || colorDifference(b, color) < 3)) continue
      offBrand.add(color)
    }
  }

  const consistency = pagesWithBrandColors / pagesWithColorData.length
  let score = 25 * consistency

  // Penalize off-brand colors
  if (offBrand.size > 5) {
    score -= 5
    issues.push(`Found ${offBrand.size} off-brand colors across pages`)
  }

  if (consistency < 0.8) {
    issues.push(`Only ${Math.round(consistency * 100)}% of pages use brand colors`)
  }

  return scored('color', score)
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
 * Calculate typography consistency score (0-20)
 */
function calculateTypographyScore(
  pageAnalyses: PageAnalysis[],
  brandFonts: FontEntry[],
  issues: string[]
): DimensionScore {
  if (brandFonts.length === 0) {
    return insufficient('typography', 'no brand fonts were identified')
  }
  const pagesWithFontData = pageAnalyses.filter(p => p.fonts.size > 0)
  if (pagesWithFontData.length === 0) {
    return insufficient('typography', 'no font declarations were found on the crawled pages')
  }

  const primaryFont = normalizeFontName((brandFonts.find(f => f.role === 'primary') ?? brandFonts[0]).name)
  const brandFontSet = new Set(brandFonts.map(f => normalizeFontName(f.name)))

  let pagesWithCorrectFonts = 0
  for (const page of pagesWithFontData) {
    if (page.fonts.has(primaryFont)) pagesWithCorrectFonts++

    // Check for random fonts
    for (const font of page.fonts) {
      if (!brandFontSet.has(font) && !isSystemFont(font)) {
        issues.push(`Page ${pathnameOf(page.url) || page.url} uses non-brand font: ${font}`)
        break
      }
    }
  }

  const consistency = pagesWithCorrectFonts / pagesWithFontData.length
  if (consistency < 0.9) {
    issues.push(`Font consistency at ${Math.round(consistency * 100)}%`)
  }

  return scored('typography', 20 * consistency)
}

/**
 * Calculate tone consistency score (0-25)
 */
function calculateToneScore(
  pages: PageData[],
  mainTone: ToneData,
  issues: string[]
): DimensionScore {
  if (!mainTone.traits || mainTone.traits.length === 0) {
    return insufficient('tone', 'no tone of voice could be determined')
  }

  const mainTraits = new Set(mainTone.traits.map(t => t.toLowerCase()))
  const homePage = pages.find(p => pathnameOf(p.url) === '/' || pathnameOf(p.url) === '')
  const aboutPage = pages.find(p => /about|company|story/i.test(pathnameOf(p.url)))
  const blogPage = pages.find(p => /blog|news|article/i.test(pathnameOf(p.url)))
  const checked = [...new Set([homePage, aboutPage, blogPage].filter((p): p is PageData => Boolean(p)))]

  if (checked.length < 2) {
    return insufficient('tone', 'needs at least two of the home, about and blog pages to compare tone')
  }

  const isCasualMain = mainTraits.has('casual') || mainTraits.has('playful') || mainTraits.has('friendly')
  let consistentPages = 0
  for (const page of checked) {
    // Simple check: are CTAs in a similar style?
    const hasExclamations = page.ctaButtons.some(c => c.includes('!'))
    const hasEmojis = page.ctaButtons.some(c => /[\u{1F300}-\u{1F9FF}]/u.test(c))
    const isCasualPage = hasExclamations || hasEmojis
    if (isCasualMain === isCasualPage) consistentPages++
  }

  const consistency = consistentPages / checked.length
  if (consistency < 0.8 && blogPage) {
    issues.push('Blog/news section may have different tone than main site')
  }

  return scored('tone', 25 * consistency)
}

/**
 * Calculate SEO consistency score (0-15)
 */
function calculateSeoScore(
  pageAnalyses: PageAnalysis[],
  issues: string[]
): DimensionScore {
  if (pageAnalyses.length < 2) {
    return insufficient('seo', 'needs at least two pages to compare')
  }

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

  return scored('seo', score)
}

/**
 * Calculate message consistency score (0-15)
 */
function calculateMessageScore(
  pageAnalyses: PageAnalysis[],
  issues: string[]
): DimensionScore {
  if (pageAnalyses.length < 2) {
    return insufficient('message', 'needs at least two pages to compare')
  }

  // Get key phrases from homepage
  const homepage = pageAnalyses.find(p => {
    const pathname = pathnameOf(p.url)
    return pathname === '/' || pathname === ''
  }) || pageAnalyses[0]

  // Core messages need at least one significant (5+ letter) word to match on
  const coreMessages = homepage.keyPhrases
    .filter(p => p.length > 10)
    .map(p => p.split(/\s+/).filter(w => w.length > 4))
    .filter(words => words.length > 0)
    .slice(0, 3)

  if (coreMessages.length === 0) {
    return insufficient('message', 'no core message was found on the home page')
  }

  // Check how many other pages reference core messages
  let messageHits = 0
  let totalChecks = 0

  for (const page of pageAnalyses) {
    if (page.url === homepage.url) continue
    totalChecks++

    const pageContent = [...page.keyPhrases, page.title, page.description].join(' ').toLowerCase()

    for (const words of coreMessages) {
      const matchCount = words.filter(w => pageContent.includes(w)).length
      if (matchCount > 0 && matchCount >= words.length * 0.3) {
        messageHits++
        break
      }
    }
  }

  if (totalChecks === 0) {
    return insufficient('message', 'no pages besides the home page to compare')
  }

  const consistency = messageHits / totalChecks
  if (consistency < 0.5) {
    issues.push('Core messaging not reinforced across pages')
  }

  return scored('message', 15 * consistency)
}

/**
 * Calculate letter grade from score
 */
function getGrade(score: number): ConsistencyGrade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

/**
 * Combine dimension results into the total score, grade and reasons
 */
export function summarizeBreakdown(
  breakdown: ConsistencyBreakdown,
  pagesAnalyzed: number
): Pick<ConsistencyData, 'score' | 'grade' | 'insufficientData'> {
  const insufficientData: string[] = []
  let earned = 0
  let possible = 0
  let scoredCount = 0

  for (const dim of DIMENSIONS) {
    const d = breakdown[dim]
    if (d.status === 'scored' && d.score !== null) {
      earned += d.score
      possible += d.max
      scoredCount++
    } else {
      insufficientData.push(`${dim}: ${d.reason ?? 'not enough data'}`)
    }
  }

  if (pagesAnalyzed < MIN_PAGES_FOR_GRADE) {
    insufficientData.unshift(
      `pages: only ${pagesAnalyzed} page${pagesAnalyzed === 1 ? '' : 's'} crawled; at least ${MIN_PAGES_FOR_GRADE} are needed for a grade`
    )
  }
  if (scoredCount < MIN_DIMENSIONS_FOR_GRADE) {
    insufficientData.push(
      `dimensions: only ${scoredCount} of ${DIMENSIONS.length} could be scored; at least ${MIN_DIMENSIONS_FOR_GRADE} are needed for a grade`
    )
  }

  const score = possible > 0 ? Math.round((earned / possible) * 100) : null
  const grade = score !== null && pagesAnalyzed >= MIN_PAGES_FOR_GRADE && scoredCount >= MIN_DIMENSIONS_FOR_GRADE
    ? getGrade(score)
    : null

  return { score, grade, insufficientData }
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
  const resolve = createVarResolver(collectCssVariables([...cssContents.values()].flat()))
  const cache = new Map<string, { colors: Set<string>; fonts: Set<string> }>()

  // Analyze each page
  const pageAnalyses = pages.map(page =>
    analyzePage(page, cssContents.get(page.url)?.join('\n') || '', resolve, cache)
  )

  const breakdown: ConsistencyBreakdown = {
    color: calculateColorScore(pageAnalyses, brandColors, issues),
    typography: calculateTypographyScore(pageAnalyses, brandFonts, issues),
    tone: calculateToneScore(pages, mainTone, issues),
    seo: calculateSeoScore(pageAnalyses, issues),
    message: calculateMessageScore(pageAnalyses, issues),
  }

  return {
    ...summarizeBreakdown(breakdown, pages.length),
    breakdown,
    issues: issues.slice(0, 10), // Limit to top 10 issues
    pagesAnalyzed: pages.length,
  }
}
