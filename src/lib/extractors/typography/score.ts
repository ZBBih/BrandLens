/**
 * Typography scoring from the comprehensive element scan
 * (typographyExtractor's in-browser pass): resolves names, assigns roles
 * and derives confidence from usage counts.
 */

import type { PageData } from '../../crawler'
import type { FontEntry } from '../types'
import type { TypographyExtractionResult, AvailableFont } from '../typographyExtractor'
import {
  UNIDENTIFIED_FONT,
  fontExtras,
  hasUnresolvedVar,
  isIconFont,
  isSystemFont,
  isUnidentifiedFont,
} from './parse'

/**
 * Check if a font is explicitly loaded (via Google Fonts, @font-face, etc.)
 */
function isExplicitlyLoaded(fontName: string, availableFonts: AvailableFont[]): AvailableFont | undefined {
  const lowerName = fontName.toLowerCase().replace(/\s+/g, '')
  return availableFonts.find(f =>
    f.name.toLowerCase().replace(/\s+/g, '') === lowerName
  )
}

/**
 * Extract typography from comprehensive element scan
 * Uses the new typographyExtractor that scans ALL visible text elements
 */
export function extractFromComprehensiveScan(
  pages: PageData[]
): { fonts: Map<string, FontEntry>; extraction: TypographyExtractionResult | null } {
  const fonts = new Map<string, FontEntry>()

  // Find the first page with comprehensive typography extraction
  let extraction: TypographyExtractionResult | null = null
  for (const page of pages) {
    const pageExtraction = fontExtras(page).typographyExtraction
    if (pageExtraction) {
      extraction = pageExtraction
      break
    }
  }

  if (!extraction) {
    return { fonts, extraction: null }
  }

  // Helper to resolve font name - tries CSS variables, then uses fallback
  const resolveFontNameFromExtraction = (fontName: string | null): string | null => {
    if (!fontName) return null

    // If it's an unresolved CSS variable, try to resolve from extraction data
    if (hasUnresolvedVar(fontName)) {
      // Try to resolve from collected CSS variables
      const varMatch = fontName.match(/var\(([^),]+)/)
      if (varMatch && extraction?.cssVariables) {
        const varName = varMatch[1].trim()
        const resolved = extraction.cssVariables[varName]
        if (resolved && !hasUnresolvedVar(resolved)) {
          // Clean the resolved value - take first font in stack
          return resolved.split(',')[0].trim().replace(/['"]/g, '')
        }
      }

      // If still unresolved, try to find a matching available font
      const availableCustomFont = extraction?.availableFonts.find(f =>
        f.source !== 'adobe' || !f.name.includes('Adobe Fonts')
      )
      if (availableCustomFont) {
        return availableCustomFont.name
      }

      // Return "Custom Font (unidentified)" for truly unresolvable fonts
      return UNIDENTIFIED_FONT
    }

    return fontName
  }

  // Helper to get font source
  const getFontSource = (fontName: string): 'Google Fonts' | 'Adobe Fonts' | 'Self-hosted' | 'System font' | 'Unknown' => {
    // Skip source detection for unidentified fonts
    if (isUnidentifiedFont(fontName)) return 'Unknown'

    const available = isExplicitlyLoaded(fontName, extraction!.availableFonts)

    if (available) {
      if (available.source === 'google') return 'Google Fonts'
      if (available.source === 'adobe') return 'Adobe Fonts'
      if (available.source === 'fontface') return 'Self-hosted'
    }

    // Only mark as system font if NOT explicitly loaded
    if (isSystemFont(fontName)) return 'System font'

    return 'Unknown'
  }

  // Helper to check if we should include a font
  // Include if: explicitly loaded OR not a system font OR is the unidentified placeholder
  // BUT never include icon fonts
  const shouldIncludeFont = (fontName: string): boolean => {
    if (!fontName) return false
    // Never include icon fonts
    if (isIconFont(fontName)) return false
    // Include "Custom Font (unidentified)" so users know fonts couldn't be detected
    if (isUnidentifiedFont(fontName)) return true
    // Always include if explicitly loaded via CSS
    if (isExplicitlyLoaded(fontName, extraction!.availableFonts)) return true
    // Otherwise, exclude system fonts
    return !isSystemFont(fontName)
  }

  // Add primary body font
  const resolvedBodyFont = resolveFontNameFromExtraction(extraction.primaryBodyFont)
  if (resolvedBodyFont && shouldIncludeFont(resolvedBodyFont)) {
    const fontName = resolvedBodyFont
    const source = getFontSource(fontName)
    const originalName = extraction.primaryBodyFont || fontName
    const weights = extraction.fontWeights[originalName]
      ? Array.from(extraction.fontWeights[originalName])
      : ['400']

    // Find Google Fonts URL if available
    const googleFont = extraction.availableFonts.find(f =>
      f.name.toLowerCase() === fontName.toLowerCase() && f.source === 'google'
    )

    fonts.set(fontName.toLowerCase(), {
      name: fontName,
      role: 'primary',
      variants: weights,
      confidence: isUnidentifiedFont(fontName) ? 50 : Math.min(98, extraction.confidence + 10),
      source: 'extracted',
      googleFontsUrl: googleFont?.url,
      evidence: [{
        url: pages[0]?.url || '',
        snippet: `Font: ${fontName} (${weights.join(', ')})`,
        context: isUnidentifiedFont(fontName)
          ? 'Primary body font · Font name could not be determined from CSS'
          : `Primary body font · Used in ${extraction.rawFontCounts.body[originalName] || 0} elements · Source: ${source}`,
      }],
    })
  }

  // Add primary heading font (if different from body)
  const resolvedHeadingFont = resolveFontNameFromExtraction(extraction.primaryHeadingFont)
  if (resolvedHeadingFont &&
      shouldIncludeFont(resolvedHeadingFont) &&
      resolvedHeadingFont.toLowerCase() !== resolvedBodyFont?.toLowerCase()) {
    const fontName = resolvedHeadingFont
    const source = getFontSource(fontName)
    const originalName = extraction.primaryHeadingFont || fontName
    const weights = extraction.fontWeights[originalName]
      ? Array.from(extraction.fontWeights[originalName])
      : ['700']

    const googleFont = extraction.availableFonts.find(f =>
      f.name.toLowerCase() === fontName.toLowerCase() && f.source === 'google'
    )

    fonts.set(fontName.toLowerCase(), {
      name: fontName,
      role: 'heading',
      variants: weights,
      confidence: isUnidentifiedFont(fontName) ? 50 : Math.min(98, extraction.confidence + 5),
      source: 'extracted',
      googleFontsUrl: googleFont?.url,
      evidence: [{
        url: pages[0]?.url || '',
        snippet: `Font: ${fontName} (${weights.join(', ')})`,
        context: isUnidentifiedFont(fontName)
          ? 'Primary heading font · Font name could not be determined from CSS'
          : `Primary heading font · Used in ${extraction.rawFontCounts.headings[originalName] || 0} headings · Source: ${source}`,
      }],
    })
  }

  // Add ALL other fonts used on elements (from rawFontCounts)
  const allUsedFonts = new Set([
    ...Object.keys(extraction.rawFontCounts.headings),
    ...Object.keys(extraction.rawFontCounts.body)
  ])

  for (const fontName of allUsedFonts) {
    if (fonts.has(fontName.toLowerCase())) continue
    if (!shouldIncludeFont(fontName)) continue

    const source = getFontSource(fontName)
    const headingCount = extraction.rawFontCounts.headings[fontName] || 0
    const bodyCount = extraction.rawFontCounts.body[fontName] || 0
    const totalCount = headingCount + bodyCount

    const weights = extraction.fontWeights[fontName]
      ? Array.from(extraction.fontWeights[fontName])
      : ['400']

    const googleFont = extraction.availableFonts.find(f =>
      f.name.toLowerCase() === fontName.toLowerCase() && f.source === 'google'
    )

    // Determine role based on usage
    const role: 'heading' | 'primary' | 'secondary' | 'accent' =
      headingCount > bodyCount ? 'heading' :
      bodyCount > 10 ? 'primary' : 'secondary'

    fonts.set(fontName.toLowerCase(), {
      name: fontName,
      role,
      variants: weights,
      confidence: Math.min(90, 50 + totalCount), // Confidence based on usage count
      source: 'extracted',
      googleFontsUrl: googleFont?.url,
      evidence: [{
        url: pages[0]?.url || '',
        snippet: `Font: ${fontName} (${weights.join(', ')})`,
        context: `Used in ${totalCount} elements (${headingCount} headings, ${bodyCount} body) · Source: ${source}`,
      }],
    })
  }

  // Add available fonts from CSS that aren't used in any elements (but loaded)
  for (const available of extraction.availableFonts) {
    if (available.source === 'adobe' && available.name === 'Adobe Fonts (Typekit)') continue
    if (fonts.has(available.name.toLowerCase())) continue

    const sourceLabel = available.source === 'google' ? 'Google Fonts'
      : available.source === 'fontface' ? 'Self-hosted'
      : available.source === 'adobe' ? 'Adobe Fonts'
      : 'Unknown'

    fonts.set(available.name.toLowerCase(), {
      name: available.name,
      role: 'secondary',
      variants: available.weights || ['400'],
      confidence: 70, // Lower confidence for loaded but unused
      source: 'extracted',
      googleFontsUrl: available.source === 'google' ? available.url : undefined,
      evidence: [{
        url: pages[0]?.url || '',
        snippet: `Font: ${available.name}`,
        context: `Loaded via ${sourceLabel} but not detected in visible text`,
      }],
    })
  }

  return { fonts, extraction }
}
