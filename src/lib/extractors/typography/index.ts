/**
 * Typography extractor - robust multi-layer font detection
 *
 * Detection layers:
 * 1. Comprehensive scan of ALL visible text elements (score.ts)
 * 2. getComputedStyle from Playwright (detect.ts)
 * 3. CSS variable resolution from :root
 * 4. document.fonts API (loaded fonts)
 * 5. Google Fonts link parsing
 * 6. @font-face declarations
 * 7. CSS parsing fallback (detect.ts)
 */

import type { PageData, FontSource } from '../../crawler'
import type { FontEntry, TypographyData } from '../types'
import { getNonInspectableTextWarning } from '../typographyExtractor'
import type { TypographyExtractionResult } from '../typographyExtractor'
import {
  cleanFontName,
  fontExtras,
  isCssVariable,
  isGenericFallback,
  isIconFont,
  isUnidentifiedFont,
  normalizeFontKey,
} from './parse'
import { extractFromComputedFonts, extractFromCss } from './detect'
import { extractFromComprehensiveScan } from './score'

/**
 * Extract typography data from crawled pages
 */
export function extractTypography(
  pages: PageData[],
  cssContents: Map<string, string[]>
): TypographyData {
  // Collect all font sources from pages
  const allFontSources: FontSource[] = []
  for (const page of pages) {
    if (page.fontSources) {
      allFontSources.push(...page.fontSources)
    }
  }

  // Check if we have comprehensive typography extraction (new method)
  const hasComprehensiveExtraction = pages.some(p => fontExtras(p).typographyExtraction)

  // Check if we have computed fonts from Playwright (legacy method)
  const hasComputedFonts = pages.some(p => p.computedFonts && Object.keys(p.computedFonts).length > 0)

  let fonts: Map<string, FontEntry>
  let extraction: TypographyExtractionResult | null = null

  if (hasComprehensiveExtraction) {
    // Use new comprehensive element scan (preferred)
    const result = extractFromComprehensiveScan(pages)
    fonts = result.fonts
    extraction = result.extraction

    // If comprehensive scan found no custom fonts, fall back to legacy methods
    if (fonts.size === 0) {
      if (hasComputedFonts) {
        fonts = extractFromComputedFonts(pages, allFontSources)
      } else {
        fonts = extractFromCss(pages, cssContents)
      }
    }
  } else if (hasComputedFonts) {
    // Use computed styles with multi-layer resolution (legacy)
    fonts = extractFromComputedFonts(pages, allFontSources)
  } else {
    // Fallback to CSS parsing
    fonts = extractFromCss(pages, cssContents)
  }

  // Detect Google Fonts
  const googleFontsDetected = allFontSources.some(s => s.type === 'google') ||
    pages.some(p => p.html.includes('fonts.googleapis.com')) ||
    (extraction?.availableFonts.some(f => f.source === 'google') ?? false)

  // === DEBUG: Log all fonts before filtering ===
  console.log('[Typography] Raw fonts before filtering:', fonts.size)
  for (const font of fonts.values()) {
    console.log(`  - "${font.name}" (role: ${font.role}, confidence: ${font.confidence})`)
  }

  // === STEP 1: Filter out ONLY CSS variables and generic fallbacks ===
  const filteredFonts = new Map<string, FontEntry>()
  const filteredOut: string[] = []

  for (const [key, font] of fonts) {
    // Skip empty or whitespace-only
    if (!font.name || font.name.trim().length === 0) {
      filteredOut.push(`"${font.name}" - empty`)
      continue
    }

    // Skip CSS variables (var(--...) or --...)
    if (isCssVariable(font.name)) {
      filteredOut.push(`"${font.name}" - CSS variable`)
      continue
    }

    // Skip generic fallbacks (serif, sans-serif, monospace, inherit, initial, unset)
    if (isGenericFallback(font.name)) {
      filteredOut.push(`"${font.name}" - generic fallback`)
      continue
    }

    // Skip icon fonts
    if (isIconFont(font.name)) {
      filteredOut.push(`"${font.name}" - icon font`)
      continue
    }

    // Skip "unidentified" placeholder fonts
    if (isUnidentifiedFont(font.name)) {
      filteredOut.push(`"${font.name}" - unidentified placeholder`)
      continue
    }

    // Keep everything else!
    filteredFonts.set(key, font)
  }

  console.log('[Typography] Filtered out:', filteredOut)
  console.log('[Typography] Fonts after filtering:', filteredFonts.size)

  // === STEP 2: Deduplicate fonts with different formats ===
  // Group fonts by normalized key, keeping the one with highest confidence
  const normalizedKeyToFont = new Map<string, FontEntry>()

  for (const [, font] of filteredFonts) {
    const normalizedKey = normalizeFontKey(font.name)
    const existing = normalizedKeyToFont.get(normalizedKey)

    if (!existing || font.confidence > existing.confidence) {
      // Clean up the font name for display
      const cleanedFont = {
        ...font,
        name: cleanFontName(font.name)
      }
      normalizedKeyToFont.set(normalizedKey, cleanedFont)
    }
  }

  console.log('[Typography] Fonts after deduplication:', normalizedKeyToFont.size)
  for (const [key, font] of normalizedKeyToFont) {
    console.log(`  - "${font.name}" (key: ${key})`)
  }

  // === STEP 3: Sort by confidence and limit to top 10 ===
  // Don't filter by usage - just keep all deduplicated fonts
  const sortedFonts = Array.from(normalizedKeyToFont.values()).sort((a, b) => {
    // Primary and heading fonts always come first
    const roleOrder: Record<string, number> = { primary: 0, heading: 1, button: 2, accent: 3, secondary: 4 }
    const roleCompare = (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5)
    if (roleCompare !== 0) return roleCompare
    // Then by confidence
    return b.confidence - a.confidence
  })

  // Limit to top 10 fonts (usually brands have 2-5)
  const MAX_FONTS = 10
  const finalFonts = sortedFonts.slice(0, MAX_FONTS)

  console.log('[Typography] Final fonts:', finalFonts.length)
  for (const font of finalFonts) {
    console.log(`  - "${font.name}" (role: ${font.role}, confidence: ${font.confidence})`)
  }

  // Build available fonts list from extraction (minimal filtering)
  const availableFonts = extraction?.availableFonts
    .filter(f => f.source !== 'adobe' || f.name !== 'Adobe Fonts (Typekit)')
    .filter(f => !isCssVariable(f.name))
    .filter(f => !isGenericFallback(f.name))
    .filter(f => !isIconFont(f.name))
    .map(f => ({
      name: cleanFontName(f.name),
      source: f.source,
      weights: f.weights
    })) ?? []

  // Deduplicate available fonts too
  const uniqueAvailableFonts = availableFonts.reduce((acc, font) => {
    const key = normalizeFontKey(font.name)
    if (!acc.some(f => normalizeFontKey(f.name) === key)) {
      acc.push(font)
    }
    return acc
  }, [] as typeof availableFonts)

  // Get flags and warning
  const flags = extraction?.flags
  const nonInspectableTextWarning = flags ? getNonInspectableTextWarning(flags) : null

  // Build extraction stats
  const extractionStats = extraction ? {
    totalElementsScanned: extraction.stats.totalElementsScanned,
    headingElementsCount: extraction.stats.headingElementsCount,
    bodyElementsCount: extraction.stats.bodyElementsCount,
    confidence: extraction.confidence
  } : undefined

  return {
    fonts: finalFonts,
    googleFontsDetected,
    availableFonts: uniqueAvailableFonts.length > 0 ? uniqueAvailableFonts.slice(0, 10) : undefined,
    flags,
    nonInspectableTextWarning,
    extractionStats
  }
}
