/**
 * Typography extractor - robust multi-layer font detection
 *
 * Detection layers:
 * 1. Comprehensive scan of ALL visible text elements (primary - new!)
 * 2. getComputedStyle from Playwright (secondary)
 * 3. CSS variable resolution from :root
 * 4. document.fonts API (loaded fonts)
 * 5. Google Fonts link parsing
 * 6. @font-face declarations
 * 7. CSS parsing fallback
 */

import { PageData, ComputedFontInfo, FontSource } from '../crawler'
import { FontEntry, TypographyData } from './types'
import {
  TypographyExtractionResult,
  AvailableFont,
  getNonInspectableTextWarning,
  cleanFontNameForDisplay
} from './typographyExtractor'

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
  return SYSTEM_FONTS.has(lower)
}

/**
 * Check if font name contains unresolved CSS variable
 */
function hasUnresolvedVar(fontName: string): boolean {
  return fontName.includes('var(') || fontName.startsWith('--')
}

/**
 * Check if font name is the "unidentified" placeholder
 */
function isUnidentifiedFont(fontName: string): boolean {
  return fontName === 'Custom Font (unidentified)'
}

/**
 * Check if font is an icon font (should be filtered out)
 */
function isIconFont(fontName: string): boolean {
  const iconPatterns = [
    'fontawesome', 'font awesome', 'fa-', 'fa solid', 'fa brands', 'fa regular',
    'material', 'icon', 'awb-icons', 'revicons', 'icomoon', 'glyphicon',
    'dashicons', 'eleganticons', 'feather', 'ionicons', 'star', 'etmodules'
  ]
  const lower = fontName.toLowerCase()
  return iconPatterns.some(p => lower.includes(p))
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
function extractFromComprehensiveScan(
  pages: PageData[],
  fontSources: FontSource[]
): { fonts: Map<string, FontEntry>; extraction: TypographyExtractionResult | null } {
  const fonts = new Map<string, FontEntry>()

  // Find the first page with comprehensive typography extraction
  let extraction: TypographyExtractionResult | null = null
  for (const page of pages) {
    const pageAny = page as any
    if (pageAny.typographyExtraction) {
      extraction = pageAny.typographyExtraction
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
      return cleanFontNameForDisplay(fontName)
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
  const hasComprehensiveExtraction = pages.some(p => (p as any).typographyExtraction)

  // Check if we have computed fonts from Playwright (legacy method)
  const hasComputedFonts = pages.some(p => p.computedFonts && Object.keys(p.computedFonts).length > 0)

  let fonts: Map<string, FontEntry>
  let extraction: TypographyExtractionResult | null = null

  if (hasComprehensiveExtraction) {
    // Use new comprehensive element scan (preferred)
    const result = extractFromComprehensiveScan(pages, allFontSources)
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

  // Sort fonts by role priority and confidence
  const sortedFonts = Array.from(fonts.values()).sort((a, b) => {
    const roleOrder: Record<string, number> = { primary: 0, heading: 1, button: 2, accent: 3, secondary: 4 }
    const roleCompare = (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5)
    if (roleCompare !== 0) return roleCompare
    return b.confidence - a.confidence
  })

  // Build available fonts list from extraction
  const availableFonts = extraction?.availableFonts
    .filter(f => f.source !== 'adobe' || f.name !== 'Adobe Fonts (Typekit)')
    .map(f => ({
      name: f.name,
      source: f.source,
      weights: f.weights
    })) ?? []

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
    fonts: sortedFonts,
    googleFontsDetected,
    availableFonts: availableFonts.length > 0 ? availableFonts : undefined,
    flags,
    nonInspectableTextWarning,
    extractionStats
  }
}
