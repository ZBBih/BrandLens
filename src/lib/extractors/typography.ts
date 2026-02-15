/**
 * Typography extractor - robust multi-layer font detection
 *
 * Detection layers:
 * 1. getComputedStyle from Playwright (primary)
 * 2. CSS variable resolution from :root
 * 3. document.fonts API (loaded fonts)
 * 4. Google Fonts link parsing
 * 5. @font-face declarations
 * 6. CSS parsing fallback
 */

import { PageData, ComputedFontInfo, FontSource } from '../crawler'
import { FontEntry, TypographyData } from './types'

// Common system fonts to filter out
const SYSTEM_FONTS = new Set([
  'arial',
  'helvetica',
  'verdana',
  'georgia',
  'times',
  'times new roman',
  'courier',
  'courier new',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  '-apple-system',
  'blinkmacsystemfont',
  'segoe ui',
  'roboto',
  'oxygen',
  'ubuntu',
  'cantarell',
  'fira sans',
  'droid sans',
  'helvetica neue',
  'inherit',
  'initial',
  'unset',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'sf pro',
  'sf pro display',
  'sf pro text',
])

/**
 * Check if a font name is a system font
 */
function isSystemFont(fontName: string): boolean {
  if (!fontName) return true
  const lower = fontName.toLowerCase().trim()
  return SYSTEM_FONTS.has(lower) || lower.includes('var(')
}

/**
 * Check if font name contains unresolved CSS variable
 */
function hasUnresolvedVar(fontName: string): boolean {
  return fontName.includes('var(') || fontName.includes('--')
}

/**
 * Detect the source of a font
 */
function detectFontSource(
  fontName: string,
  googleFonts: string[],
  fontSources: FontSource[]
): 'Google Fonts' | 'Adobe Fonts' | 'Self-hosted' | 'System font' | 'Unknown' {
  const lowerName = fontName.toLowerCase().replace(/\s+/g, '')

  // Check if it's in the Google Fonts list
  if (googleFonts.some(gf => gf.toLowerCase().replace(/\s+/g, '') === lowerName)) {
    return 'Google Fonts'
  }

  // Check Google Fonts URL
  const googleSource = fontSources.find(s => s.type === 'google')
  if (googleSource?.url) {
    const urlLower = googleSource.url.toLowerCase().replace(/\+/g, '')
    if (urlLower.includes(lowerName)) {
      return 'Google Fonts'
    }
  }

  // Check Adobe Fonts
  if (fontSources.some(s => s.type === 'adobe')) {
    return 'Adobe Fonts'
  }

  // Check @font-face
  const fontFaceSource = fontSources.find(s => s.type === 'fontface')
  if (fontFaceSource?.fonts?.some(f => f.toLowerCase().includes(lowerName))) {
    return 'Self-hosted'
  }

  // Check if it's a system font
  if (isSystemFont(fontName)) {
    return 'System font'
  }

  return 'Unknown'
}

/**
 * Parse Google Fonts URL to extract font names and weights
 */
function parseGoogleFontsUrl(url: string): { name: string; weights: string[] }[] {
  const fonts: { name: string; weights: string[] }[] = []

  try {
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
  } catch {
    // Fallback: basic extraction
  }

  return fonts
}

/**
 * Extract typography using robust multi-layer detection
 */
function extractFromComputedFonts(
  pages: PageData[],
  fontSources: FontSource[]
): Map<string, FontEntry> {
  const fonts = new Map<string, FontEntry>()

  // Collect additional font data from pages
  let loadedFonts: string[] = []
  let googleFonts: string[] = []
  let cssVariables: Record<string, string> = {}

  for (const page of pages) {
    // Get extra font data if available
    const pageAny = page as any
    if (pageAny.loadedFonts) {
      loadedFonts = [...new Set([...loadedFonts, ...pageAny.loadedFonts])]
    }
    if (pageAny.googleFonts) {
      googleFonts = [...new Set([...googleFonts, ...pageAny.googleFonts])]
    }
    if (pageAny.cssVariables) {
      cssVariables = { ...cssVariables, ...pageAny.cssVariables }
    }
  }

  // Also parse Google Fonts from fontSources
  for (const source of fontSources) {
    if (source.type === 'google' && source.url) {
      const parsed = parseGoogleFontsUrl(source.url)
      for (const { name } of parsed) {
        if (!googleFonts.includes(name)) {
          googleFonts.push(name)
        }
      }
    }
  }

  for (const page of pages) {
    if (!page.computedFonts) continue

    const computedFonts = page.computedFonts

    // Helper to resolve and validate font name
    const resolveFontName = (fontData: ComputedFontInfo | undefined): string | null => {
      if (!fontData) return null

      let fontName = fontData.fontFamily

      // Step 1: Resolve CSS variables
      if (hasUnresolvedVar(fontName)) {
        const varMatch = fontName.match(/var\(([^),]+)/)
        if (varMatch) {
          const varName = varMatch[1].trim()
          if (cssVariables[varName]) {
            fontName = cssVariables[varName].split(',')[0].trim().replace(/['"]/g, '')
          }
        }
      }

      // Step 2: If still unresolved, check loaded fonts
      if (hasUnresolvedVar(fontName) || !fontName || fontName === 'Unknown') {
        if (loadedFonts.length > 0) {
          fontName = loadedFonts[0]
        }
      }

      // Step 3: Cross-reference with Google Fonts
      const googleMatch = googleFonts.find(gf =>
        gf.toLowerCase() === fontName.toLowerCase() ||
        fontData.fontFamily.toLowerCase().includes(gf.toLowerCase())
      )
      if (googleMatch) {
        fontName = googleMatch
      }

      // Step 4: Skip system fonts
      if (isSystemFont(fontName)) {
        // Try loaded fonts as alternative
        const customLoaded = loadedFonts.find(f => !isSystemFont(f))
        if (customLoaded) {
          fontName = customLoaded
        } else {
          return null
        }
      }

      return fontName
    }

    // Process heading font (h1 > h2 > h3 > hero)
    const headingFontData = computedFonts.h1 || computedFonts.h2 || computedFonts.h3 || (computedFonts as any).hero
    const headingName = resolveFontName(headingFontData)
    if (headingName && !fonts.has(headingName.toLowerCase())) {
      const source = detectFontSource(headingName, googleFonts, fontSources)
      fonts.set(headingName.toLowerCase(), {
        name: headingName,
        role: 'heading',
        variants: [headingFontData?.fontWeight || '700'],
        confidence: source === 'Google Fonts' ? 98 : source === 'Self-hosted' ? 90 : 85,
        source: 'extracted',
        evidence: [{
          url: page.url,
          snippet: `Font: ${headingName} (${headingFontData?.fontWeight || 'normal'})`,
          context: `Detected from heading elements · Source: ${source}`,
        }],
      })
    }

    // Process body font
    const bodyFontData = computedFonts.body
    const bodyName = resolveFontName(bodyFontData)
    if (bodyName && bodyName.toLowerCase() !== headingName?.toLowerCase() && !fonts.has(bodyName.toLowerCase())) {
      const source = detectFontSource(bodyName, googleFonts, fontSources)
      fonts.set(bodyName.toLowerCase(), {
        name: bodyName,
        role: 'primary',
        variants: [bodyFontData?.fontWeight || '400'],
        confidence: source === 'Google Fonts' ? 98 : source === 'Self-hosted' ? 90 : 85,
        source: 'extracted',
        evidence: [{
          url: page.url,
          snippet: `Font: ${bodyName} (${bodyFontData?.fontWeight || 'normal'})`,
          context: `Detected from body text · Source: ${source}`,
        }],
      })
    }

    // If heading and body are the same, just use one font as primary
    if (bodyName && headingName && bodyName.toLowerCase() === headingName.toLowerCase()) {
      const existingFont = fonts.get(bodyName.toLowerCase())
      if (existingFont) {
        existingFont.role = 'primary'
      }
    }

    // Process button font (only if different)
    const buttonFontData = computedFonts.button
    const buttonName = resolveFontName(buttonFontData)
    if (buttonName &&
        buttonName.toLowerCase() !== headingName?.toLowerCase() &&
        buttonName.toLowerCase() !== bodyName?.toLowerCase() &&
        !fonts.has(buttonName.toLowerCase())) {
      const source = detectFontSource(buttonName, googleFonts, fontSources)
      fonts.set(buttonName.toLowerCase(), {
        name: buttonName,
        role: 'button',
        variants: [buttonFontData?.fontWeight || '600'],
        confidence: source === 'Google Fonts' ? 95 : 80,
        source: 'extracted',
        evidence: [{
          url: page.url,
          snippet: `Font: ${buttonName} (${buttonFontData?.fontWeight || 'normal'})`,
          context: `Detected from buttons · Source: ${source}`,
        }],
      })
    }

    // Process nav font (only if different)
    const navFontData = computedFonts.nav
    const navName = resolveFontName(navFontData)
    if (navName &&
        navName.toLowerCase() !== headingName?.toLowerCase() &&
        navName.toLowerCase() !== bodyName?.toLowerCase() &&
        !fonts.has(navName.toLowerCase())) {
      const source = detectFontSource(navName, googleFonts, fontSources)
      fonts.set(navName.toLowerCase(), {
        name: navName,
        role: 'accent',
        variants: [navFontData?.fontWeight || '500'],
        confidence: source === 'Google Fonts' ? 95 : 75,
        source: 'extracted',
        evidence: [{
          url: page.url,
          snippet: `Font: ${navName} (${navFontData?.fontWeight || 'normal'})`,
          context: `Detected from navigation · Source: ${source}`,
        }],
      })
    }
  }

  // If we have no fonts yet but have Google Fonts detected, use those
  if (fonts.size === 0 && googleFonts.length > 0) {
    for (let i = 0; i < Math.min(googleFonts.length, 2); i++) {
      const fontName = googleFonts[i]
      const googleSource = fontSources.find(s => s.type === 'google')
      fonts.set(fontName.toLowerCase(), {
        name: fontName,
        role: i === 0 ? 'primary' : 'heading',
        variants: ['400'],
        confidence: 95,
        source: 'extracted',
        googleFontsUrl: googleSource?.url,
        evidence: [{
          url: 'Google Fonts',
          snippet: `Font: ${fontName}`,
          context: 'Detected from Google Fonts link',
        }],
      })
    }
  }

  // If still no fonts but have loaded fonts, use those
  if (fonts.size === 0 && loadedFonts.length > 0) {
    for (let i = 0; i < Math.min(loadedFonts.length, 2); i++) {
      const fontName = loadedFonts[i]
      if (!isSystemFont(fontName)) {
        fonts.set(fontName.toLowerCase(), {
          name: fontName,
          role: i === 0 ? 'primary' : 'heading',
          variants: ['400'],
          confidence: 85,
          source: 'extracted',
          evidence: [{
            url: 'document.fonts',
            snippet: `Font: ${fontName}`,
            context: 'Detected from loaded fonts',
          }],
        })
      }
    }
  }

  // Add Google Fonts URL to matching entries
  for (const page of pages) {
    if (page.fontSources) {
      const googleSource = page.fontSources.find(s => s.type === 'google')
      if (googleSource) {
        for (const [, font] of fonts) {
          const fontLower = font.name.toLowerCase().replace(/\s+/g, '+')
          if (googleSource.url.toLowerCase().includes(fontLower)) {
            font.googleFontsUrl = googleSource.url
          }
        }
      }
    }
  }

  return fonts
}

/**
 * Fallback: Extract from CSS when computed styles aren't available
 */
function extractFromCss(
  pages: PageData[],
  cssContents: Map<string, string[]>
): Map<string, FontEntry> {
  const fonts = new Map<string, FontEntry>()

  // Check for Google Fonts in HTML
  for (const page of pages) {
    const gfMatches = page.html.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css2?\?[^"]+)"/g)
    for (const gfMatch of gfMatches) {
      const parsedFonts = parseGoogleFontsUrl(gfMatch[1])
      for (let i = 0; i < parsedFonts.length; i++) {
        const { name, weights } = parsedFonts[i]
        const key = name.toLowerCase()
        if (!fonts.has(key) && !isSystemFont(name)) {
          fonts.set(key, {
            name,
            role: i === 0 ? 'primary' : 'heading',
            variants: weights,
            confidence: 90,
            source: 'extracted',
            googleFontsUrl: gfMatch[1],
            evidence: [{
              url: page.url,
              snippet: `Google Fonts: ${name}`,
              context: 'Google Fonts link',
            }],
          })
        }
      }
    }
  }

  // Extract from CSS font-family declarations
  for (const [pageUrl, cssArray] of cssContents) {
    for (const css of cssArray) {
      const fontFamilyRegex = /font-family\s*:\s*([^;}]+)/gi
      let match
      while ((match = fontFamilyRegex.exec(css)) !== null) {
        const fontStack = match[1]
          .split(',')
          .map(f => f.trim().replace(/['"`]/g, ''))
          .filter(f => f && !isSystemFont(f) && !hasUnresolvedVar(f))

        if (fontStack.length > 0) {
          const fontName = fontStack[0]
          const key = fontName.toLowerCase()
          if (!fonts.has(key)) {
            fonts.set(key, {
              name: fontName,
              role: 'secondary',
              confidence: 70,
              source: 'extracted',
              evidence: [{
                url: pageUrl,
                snippet: `font-family: ${fontStack.join(', ')}`,
                context: 'CSS declaration',
              }],
            })
          }
        }
      }
    }
  }

  return fonts
}

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

  // Check if we have computed fonts from Playwright
  const hasComputedFonts = pages.some(p => p.computedFonts && Object.keys(p.computedFonts).length > 0)

  let fonts: Map<string, FontEntry>

  if (hasComputedFonts) {
    // Use computed styles with multi-layer resolution
    fonts = extractFromComputedFonts(pages, allFontSources)
  } else {
    // Fallback to CSS parsing
    fonts = extractFromCss(pages, cssContents)
  }

  // Detect Google Fonts
  const googleFontsDetected = allFontSources.some(s => s.type === 'google') ||
    pages.some(p => p.html.includes('fonts.googleapis.com'))

  // Sort fonts by role priority and confidence
  const sortedFonts = Array.from(fonts.values()).sort((a, b) => {
    const roleOrder: Record<string, number> = { primary: 0, heading: 1, button: 2, accent: 3, secondary: 4 }
    const roleCompare = (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5)
    if (roleCompare !== 0) return roleCompare
    return b.confidence - a.confidence
  })

  return {
    fonts: sortedFonts,
    googleFontsDetected,
  }
}
