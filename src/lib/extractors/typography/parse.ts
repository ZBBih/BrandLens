/**
 * Typography parsing helpers: font-name classification, normalization and
 * Google Fonts URL parsing. Pure functions with no page access.
 */

import type { PageData } from '../../crawler'
import type { TypographyExtractionResult } from '../typographyExtractor'

/**
 * Extra font data the Playwright crawler attaches to a page
 * (see crawler/playwright.ts). All fields are optional because static
 * (Cheerio) pages never carry them.
 */
export type PageWithFontExtras = PageData & {
  loadedFonts?: string[]
  googleFonts?: string[]
  cssVariables?: Record<string, string>
  typographyExtraction?: TypographyExtractionResult
}

/**
 * Read the optional Playwright font extras from a page
 */
export function fontExtras(page: PageData): PageWithFontExtras {
  return page as PageWithFontExtras
}

/**
 * Placeholder used when a font family cannot be resolved to a real name.
 * Matches typographyExtractor.cleanFontNameForDisplay's placeholder.
 */
export const UNIDENTIFIED_FONT = 'Custom Font (unidentified)'

// ONLY filter out these exact generic CSS fallbacks - nothing else
const GENERIC_FALLBACKS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'inherit',
  'initial',
  'unset',
  'none',
  'normal',
  'auto',
])

/**
 * Check if font name is a CSS variable (starts with var( or --)
 */
export function isCssVariable(fontName: string): boolean {
  if (!fontName) return true
  const trimmed = fontName.trim()
  return (
    trimmed.startsWith('var(') ||
    trimmed.startsWith('--') ||
    trimmed.includes('var(--')
  )
}

/**
 * Check if font name is a generic fallback that should be filtered
 */
export function isGenericFallback(fontName: string): boolean {
  if (!fontName) return true
  const cleaned = fontName.toLowerCase().replace(/['"]/g, '').trim()
  return GENERIC_FALLBACKS.has(cleaned)
}

/**
 * Normalize font name for deduplication
 * Converts "bebas-neue", "Bebas Neue", "BebasNeue" to same key
 */
export function normalizeFontKey(fontName: string): string {
  return fontName
    .toLowerCase()
    .replace(/[-_\s]+/g, '') // Remove separators
    .replace(/['"]/g, '') // Remove quotes
    .replace(/ltstd|ltstd-|std/gi, '') // Remove "LT Std" variations
    .trim()
}

/**
 * Clean font name for display - remove quotes, trim whitespace and
 * title-case ALL-CAPS or kebab-case names. (typographyExtractor's
 * cleanFontNameForDisplay only strips quotes and maps var() to the
 * placeholder; the two do not overlap beyond quote stripping.)
 */
export function cleanFontName(fontName: string): string {
  // Remove quotes and trim
  const cleaned = fontName.replace(/['"]/g, '').trim()

  // If already has mixed case, keep it
  if (/[A-Z]/.test(cleaned) && /[a-z]/.test(cleaned)) {
    return cleaned
  }

  // If all uppercase or contains specific patterns, format nicely
  if (/^[A-Z\s-]+$/.test(cleaned)) {
    // All uppercase - title case it
    return cleaned
      .split(/[\s-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Convert kebab-case to Title Case only if it looks like kebab-case
  if (cleaned.includes('-') && !/[A-Z]/.test(cleaned)) {
    return cleaned
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }

  return cleaned
}

/**
 * Check if a font name is a system font (for fallback detection, not filtering)
 * NOTE: We don't filter these out anymore - we keep them if they're explicitly used
 */
export function isSystemFont(fontName: string): boolean {
  if (!fontName) return true
  const lower = fontName.toLowerCase().replace(/['"]/g, '').trim()
  // Only consider these as "system fonts" for categorization purposes
  const systemFonts = new Set([
    'arial', 'helvetica', 'verdana', 'georgia', 'times', 'times new roman',
    'courier', 'courier new', 'system-ui', '-apple-system', 'blinkmacsystemfont',
    'segoe ui', 'tahoma', 'geneva', 'lucida grande', 'trebuchet ms'
  ])
  return systemFonts.has(lower)
}

/**
 * Check if font name contains unresolved CSS variable
 */
export function hasUnresolvedVar(fontName: string): boolean {
  return fontName.includes('var(') || fontName.startsWith('--')
}

/**
 * Check if font name is the "unidentified" placeholder
 */
export function isUnidentifiedFont(fontName: string): boolean {
  return fontName === UNIDENTIFIED_FONT
}

/**
 * Check if font is an icon font (should be filtered out)
 */
export function isIconFont(fontName: string): boolean {
  const iconPatterns = [
    'fontawesome', 'font awesome', 'fa-', 'fa solid', 'fa brands', 'fa regular',
    'material', 'icon', 'awb-icons', 'revicons', 'icomoon', 'glyphicon',
    'dashicons', 'eleganticons', 'feather', 'ionicons', 'star', 'etmodules'
  ]
  const lower = fontName.toLowerCase()
  return iconPatterns.some(p => lower.includes(p))
}

/**
 * Parse Google Fonts URL to extract font names and weights
 */
export function parseGoogleFontsUrl(url: string): { name: string; weights: string[] }[] {
  const fonts: { name: string; weights: string[] }[] = []

  // Handle multiple family parameters
  const familyMatches = url.match(/family=([^&]+)/g)
  if (familyMatches) {
    for (const familyMatch of familyMatches) {
      const familyStr = familyMatch.replace('family=', '')

      // Split by | for old format or process single family
      const families = familyStr.split('|')
      for (const family of families) {
        const parts = family.split(':')
        const name = parts[0].replace(/\+/g, ' ').trim()

        let weights: string[] = []
        if (parts[1]) {
          // Extract weights from various formats
          const weightMatch = parts[1].match(/wght@([\d;,]+)/)
          if (weightMatch) {
            weights = weightMatch[1].split(/[;,]/).filter(w => /^\d+$/.test(w))
          } else {
            weights = parts[1].split(/[;,]/).filter(w => /^\d+$/.test(w))
          }
        }

        if (name && !isSystemFont(name)) {
          fonts.push({ name, weights: weights.length > 0 ? weights : ['400'] })
        }
      }
    }
  }

  return fonts
}
