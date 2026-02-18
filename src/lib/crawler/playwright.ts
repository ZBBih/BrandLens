/**
 * Playwright-based crawler for JavaScript-rendered pages
 * With robust multi-layer font detection
 */

import { chromium, Browser, Page } from 'playwright'
import { parseHtml, PageData, ComputedFontInfo, FontSource } from './cheerio'
import { USER_AGENT } from './robots'
import {
  getTypographyExtractionScript,
  processExtractionResult,
  TypographyExtractionResult
} from '../extractors/typographyExtractor'

let browser: Browser | null = null

const PAGE_TIMEOUT = 30000 // 30 seconds

/**
 * Get or create browser instance
 */
async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })
  }
  return browser
}

/**
 * Close the browser instance
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}

/**
 * Robust typography extraction result
 */
export interface RobustTypographyResult {
  computedFonts: Record<string, ComputedFontInfo>
  fontSources: FontSource[]
  loadedFonts: string[]
  googleFonts: string[]
  adobeFontsDetected: boolean
  cssVariables: Record<string, string>
  fontFaceDeclarations: string[]
}

/**
 * Network-intercepted font information
 */
interface InterceptedFont {
  url: string
  type: 'google' | 'adobe' | 'fontfile'
  fontNames: string[]
}

/**
 * Extract font names from a Google Fonts URL
 */
function parseGoogleFontsUrlFromNetwork(url: string): string[] {
  const fonts: string[] = []
  try {
    const familyMatches = url.match(/family=([^&]+)/g)
    if (familyMatches) {
      familyMatches.forEach(match => {
        const familyStr = match.replace('family=', '')
        familyStr.split('|').forEach(family => {
          const name = decodeURIComponent(family.split(':')[0].replace(/\+/g, ' ')).trim()
          if (name && !fonts.includes(name)) {
            fonts.push(name)
          }
        })
      })
    }
  } catch {}
  return fonts
}

/**
 * Extract font name from a font file URL path
 */
function extractFontNameFromPath(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const filename = urlObj.pathname.split('/').pop() || ''
    // Remove extension
    let name = filename.replace(/\.(woff2?|ttf|otf|eot)$/i, '')
    // Remove weight/style suffixes
    name = name.replace(/[-_](regular|bold|italic|light|medium|semibold|extrabold|thin|black|heavy|book|normal|\d{3})$/gi, '')
    // Convert dashes/underscores to spaces and clean up
    name = name.replace(/[-_]/g, ' ').trim()
    // Skip if it looks like a hash or encoded string
    if (name.length > 3 && !/^[a-zA-Z0-9]{20,}$/.test(name) && !/^[A-Za-z0-9+/=]+$/.test(name)) {
      return name
    }
  } catch {}
  return null
}

/**
 * Check if a font name is an icon font (should be filtered out)
 */
function isIconFont(name: string): boolean {
  const iconPatterns = [
    'fontawesome', 'font awesome', 'fa-', 'fa solid', 'fa brands', 'fa regular',
    'material', 'icon', 'awb-icons', 'revicons', 'icomoon', 'glyphicon',
    'dashicons', 'eleganticons', 'feather', 'ionicons'
  ]
  const lower = name.toLowerCase()
  return iconPatterns.some(p => lower.includes(p))
}

/**
 * Extended page data with comprehensive typography extraction
 */
export interface ExtendedPageData extends PageData {
  typographyExtraction?: TypographyExtractionResult
}

/**
 * Crawl a single page using Playwright with robust font detection
 */
export async function crawlPageWithPlaywright(url: string): Promise<ExtendedPageData | null> {
  let page: Page | null = null

  try {
    const browserInstance = await getBrowser()
    const context = await browserInstance.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    })

    page = await context.newPage()

    // Collect font information from network requests
    const interceptedFonts: InterceptedFont[] = []

    // Monitor network responses for font files
    page.on('response', response => {
      const responseUrl = response.url()
      const contentType = response.headers()['content-type'] || ''

      // Check for Google Fonts CSS
      if (responseUrl.includes('fonts.googleapis.com')) {
        const fontNames = parseGoogleFontsUrlFromNetwork(responseUrl)
        if (fontNames.length > 0) {
          interceptedFonts.push({ url: responseUrl, type: 'google', fontNames })
        }
      }

      // Check for Adobe Fonts / Typekit
      if (responseUrl.includes('use.typekit.net') || responseUrl.includes('p.typekit.net')) {
        interceptedFonts.push({ url: responseUrl, type: 'adobe', fontNames: [] })
      }

      // Check for font file downloads
      if (responseUrl.match(/\.(woff2?|ttf|otf|eot)(\?|$)/i) || contentType.includes('font')) {
        const fontName = extractFontNameFromPath(responseUrl)
        if (fontName && !isIconFont(fontName)) {
          interceptedFonts.push({ url: responseUrl, type: 'fontfile', fontNames: [fontName] })
        }
      }
    })

    // Block only unnecessary resources - KEEP FONTS for detection!
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType()
      // Only block images, media, websocket - NOT fonts!
      if (['image', 'media', 'websocket'].includes(resourceType)) {
        return route.abort()
      }
      return route.continue()
    })

    // Navigate to the page
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: PAGE_TIMEOUT,
    })

    if (!response || !response.ok()) {
      await context.close()
      return null
    }

    // Step 1: Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')

    // Step 2: Wait extra time for JS-based font loading
    await page.waitForTimeout(2000)

    // Step 3: Wait for any web fonts to finish loading
    await page.evaluate(() => document.fonts.ready)

    // Step 4: Run comprehensive typography extraction (scans ALL visible text elements)
    const comprehensiveTypography = await page.evaluate(getTypographyExtractionScript())
    const typographyExtraction = processExtractionResult(comprehensiveTypography)

    // Step 5: Extract typography with multi-layer detection (legacy, for backwards compat)
    const typographyData = await page.evaluate(async () => {
      // Wait for fonts to load
      await document.fonts.ready

      // Helper: Clean font name from stack
      const cleanFontName = (fontStack: string): string => {
        if (!fontStack) return 'Unknown'

        // If it's a CSS variable, try to resolve it
        if (fontStack.includes('var(')) {
          // Will be resolved later with cssVariables
          return fontStack
        }

        // Get first font in stack
        const firstFont = fontStack.split(',')[0].trim()

        // Remove quotes
        return firstFont.replace(/['"]/g, '')
      }

      // Helper: Detect if font is a system font
      const isSystemFont = (fontName: string): boolean => {
        const systemFonts = [
          'system-ui', '-apple-system', 'blinkmacsystemfont',
          'segoe ui', 'roboto', 'oxygen', 'ubuntu', 'cantarell',
          'fira sans', 'droid sans', 'helvetica neue', 'helvetica',
          'arial', 'sans-serif', 'serif', 'monospace',
          'times new roman', 'times', 'georgia', 'verdana',
          'courier new', 'courier', 'sf pro', 'sf pro display',
          'ui-sans-serif', 'ui-serif', 'ui-monospace'
        ]
        return systemFonts.some(sf =>
          fontName.toLowerCase().includes(sf.toLowerCase())
        )
      }

      // Helper: Get computed font for an element
      const getFontForElement = (selector: string): ComputedFontInfo | null => {
        const el = document.querySelector(selector)
        if (!el) return null

        const computed = window.getComputedStyle(el)
        const rawFontFamily = computed.fontFamily
        const cleaned = cleanFontName(rawFontFamily)

        return {
          fontFamily: cleaned,
          fontWeight: computed.fontWeight,
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          letterSpacing: computed.letterSpacing,
          element: selector,
          rawStack: rawFontFamily,
          isSystemFont: isSystemFont(cleaned)
        } as ComputedFontInfo & { rawStack: string; isSystemFont: boolean }
      }

      // Method 1: Get computed styles for key elements
      const computedFonts: Record<string, any> = {}

      const selectors: Record<string, string> = {
        h1: 'h1',
        h2: 'h2',
        h3: 'h3',
        body: 'p, article p, .body-text, main p, body',
        button: 'button, .btn, [class*="button"], a.btn, input[type="submit"]',
        nav: 'nav a, header a, .nav-link, .navigation a',
        hero: '[class*="hero"] h1, [class*="hero"] h2, .banner h1, .jumbotron h1',
      }

      for (const [role, selector] of Object.entries(selectors)) {
        const fontData = getFontForElement(selector)
        if (fontData) {
          computedFonts[role] = fontData
        }
      }

      // Method 2: Extract CSS variables from :root and html
      const cssVariables: Record<string, string> = {}
      try {
        const rootStyles = getComputedStyle(document.documentElement)

        // Recursive variable resolver
        const resolveVar = (value: string, depth = 0): string => {
          if (depth > 5) return value
          if (!value || !value.includes('var(')) return value

          const varMatch = value.match(/var\(([^),]+)(?:,\s*([^)]+))?\)/)
          if (!varMatch) return value

          const varName = varMatch[1].trim()
          const fallback = varMatch[2]?.trim()

          let resolved = rootStyles.getPropertyValue(varName).trim()
          if (resolved) {
            return resolveVar(resolved, depth + 1)
          }

          if (fallback) {
            return resolveVar(fallback, depth + 1)
          }

          return value
        }

        // Check common font variable names
        const commonVarNames = [
          '--font-family', '--font-family-heading', '--font-family-body',
          '--font-heading', '--font-body', '--font-sans', '--font-serif',
          '--heading-font', '--body-font', '--primary-font', '--secondary-font',
          '--font-primary', '--font-secondary', '--ff-heading', '--ff-body',
          '--typography-heading', '--typography-body', '--font-display',
          '--font-main', '--font-text', '--font-title', '--base-font',
          '--heading-font-family', '--body-font-family', '--text-font-family'
        ]

        commonVarNames.forEach(varName => {
          const value = rootStyles.getPropertyValue(varName).trim()
          if (value) {
            // Fully resolve the value including nested variables
            cssVariables[varName] = resolveVar(value)
          }
        })

        // Scan all stylesheets for :root and html declarations
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            Array.from(sheet.cssRules || []).forEach(rule => {
              if (rule instanceof CSSStyleRule &&
                  (rule.selectorText === ':root' || rule.selectorText === 'html')) {
                const style = rule.style
                for (let i = 0; i < style.length; i++) {
                  const prop = style[i]
                  if (prop.startsWith('--') && prop.toLowerCase().includes('font')) {
                    const rawValue = rootStyles.getPropertyValue(prop).trim()
                    if (rawValue) {
                      cssVariables[prop] = resolveVar(rawValue)
                    }
                  }
                }
              }
            })
          } catch {
            // Cross-origin stylesheet, skip
          }
        })
      } catch (e) {
        console.error('Error extracting CSS variables:', e)
      }

      // Method 3: Get all loaded fonts from document.fonts API (MOST RELIABLE!)
      const loadedFonts: string[] = []
      const loadedFontsWithWeights: { name: string; weights: string[] }[] = []

      // Icon font patterns to filter out
      const iconFontPatterns = [
        'fontawesome', 'font awesome', 'fa-', 'fa solid', 'fa brands', 'fa regular',
        'material', 'icon', 'awb-icons', 'revicons', 'icomoon', 'glyphicon',
        'dashicons', 'eleganticons', 'feather', 'ionicons', 'star'
      ]
      const isIconFont = (name: string): boolean => {
        const lower = name.toLowerCase()
        return iconFontPatterns.some(p => lower.includes(p))
      }

      try {
        const fontMap = new Map<string, string[]>()
        document.fonts.forEach(font => {
          if (font.status === 'loaded') {
            const fontName = font.family.replace(/['"]/g, '')
            // Skip system fonts and icon fonts
            if (!isSystemFont(fontName) && !isIconFont(fontName)) {
              if (!fontMap.has(fontName)) {
                fontMap.set(fontName, [])
              }
              fontMap.get(fontName)!.push(font.weight)
            }
          }
        })

        // Convert to arrays
        fontMap.forEach((weights, name) => {
          loadedFonts.push(name)
          loadedFontsWithWeights.push({
            name,
            weights: [...new Set(weights)]
          })
        })
      } catch (e) {
        console.error('Error getting loaded fonts:', e)
      }

      // Method 4: Detect Google Fonts from link tags
      const googleFonts: string[] = []
      document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
        const href = link.getAttribute('href') || ''

        // Parse family parameter from various Google Fonts URL formats
        // Format 1: fonts.googleapis.com/css?family=Roboto:400,700
        // Format 2: fonts.googleapis.com/css2?family=Roboto:wght@400;700
        // Format 3: fonts.googleapis.com/css2?family=Roboto&family=Open+Sans

        const familyMatches = href.match(/family=([^&:]+)/g)
        if (familyMatches) {
          familyMatches.forEach(match => {
            let fontName = match.replace('family=', '').replace(/\+/g, ' ')
            // Remove weight specifiers
            fontName = fontName.split(':')[0].split('@')[0]
            if (!googleFonts.includes(fontName)) {
              googleFonts.push(fontName)
            }
          })
        }
      })

      // Also check for Google Fonts in @import statements
      document.querySelectorAll('style').forEach(style => {
        const text = style.textContent || ''
        const importMatches = text.match(/@import[^;]*fonts\.googleapis\.com[^;]*/g)
        if (importMatches) {
          importMatches.forEach(imp => {
            const familyMatch = imp.match(/family=([^&:'"]+)/)
            if (familyMatch) {
              const fontName = familyMatch[1].replace(/\+/g, ' ')
              if (!googleFonts.includes(fontName)) {
                googleFonts.push(fontName)
              }
            }
          })
        }
      })

      // Method 5: Detect Adobe Fonts (Typekit)
      const hasAdobeFonts = !!document.querySelector('link[href*="use.typekit.net"]') ||
                           !!document.querySelector('script[src*="use.typekit.net"]')

      // Method 6: Check @font-face declarations
      const fontFaceDeclarations: string[] = []
      try {
        Array.from(document.styleSheets).forEach(sheet => {
          try {
            Array.from(sheet.cssRules || []).forEach(rule => {
              if (rule instanceof CSSFontFaceRule) {
                const fontFamily = rule.style.getPropertyValue('font-family').replace(/['"]/g, '')
                if (fontFamily && !fontFaceDeclarations.includes(fontFamily)) {
                  fontFaceDeclarations.push(fontFamily)
                }
              }
            })
          } catch {
            // Cross-origin stylesheet, skip
          }
        })
      } catch (e) {
        console.error('Error checking @font-face:', e)
      }

      // Build font sources array
      const fontSources: { type: 'google' | 'adobe' | 'fontface'; url: string; fonts?: string[] }[] = []

      // Add Google Fonts sources
      document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
        const href = link.getAttribute('href')
        if (href) {
          fontSources.push({ type: 'google', url: href, fonts: googleFonts })
        }
      })

      // Add Adobe Fonts source
      if (hasAdobeFonts) {
        const typekitLink = document.querySelector('link[href*="use.typekit.net"]')
        fontSources.push({
          type: 'adobe',
          url: typekitLink?.getAttribute('href') || 'use.typekit.net'
        })
      }

      // Add @font-face fonts
      if (fontFaceDeclarations.length > 0) {
        fontSources.push({ type: 'fontface', url: '', fonts: fontFaceDeclarations })
      }

      return {
        computedFonts,
        cssVariables,
        loadedFonts,
        loadedFontsWithWeights,
        googleFonts,
        hasAdobeFonts,
        fontFaceDeclarations,
        fontSources
      }
    })

    // Get the rendered HTML
    const html = await page.content()

    // Get all CSS (including dynamically loaded)
    const stylesheets = await page.evaluate(() => {
      const sheets: string[] = []

      for (const sheet of document.styleSheets) {
        try {
          if (sheet.cssRules) {
            const rules: string[] = []
            for (const rule of sheet.cssRules) {
              rules.push(rule.cssText)
            }
            sheets.push(rules.join('\n'))
          }
        } catch {
          // Cross-origin stylesheet
        }
      }

      document.querySelectorAll('style').forEach((style) => {
        if (style.textContent) {
          sheets.push(style.textContent)
        }
      })

      return sheets
    })

    // Parse the HTML
    const pageData = parseHtml(html, url)

    // Add the dynamically loaded CSS
    pageData.inlineCss = [...pageData.inlineCss, ...stylesheets]

    // Process and resolve fonts
    const resolvedFonts = resolveFontData(typographyData)

    // Add resolved font data to page
    pageData.computedFonts = resolvedFonts.computedFonts
    pageData.fontSources = typographyData.fontSources

    // Store additional font data for the extractor
    ;(pageData as any).loadedFonts = typographyData.loadedFonts
    ;(pageData as any).loadedFontsWithWeights = typographyData.loadedFontsWithWeights
    ;(pageData as any).googleFonts = typographyData.googleFonts
    ;(pageData as any).cssVariables = typographyData.cssVariables

    // Add fonts detected from network interception
    const networkGoogleFonts = interceptedFonts
      .filter(f => f.type === 'google')
      .flatMap(f => f.fontNames)
    const networkFontFiles = interceptedFonts
      .filter(f => f.type === 'fontfile')
      .flatMap(f => f.fontNames)
    const hasNetworkAdobeFonts = interceptedFonts.some(f => f.type === 'adobe')

    // Merge network-detected fonts with page-detected fonts
    ;(pageData as any).googleFonts = [...new Set([
      ...typographyData.googleFonts,
      ...networkGoogleFonts
    ])]
    ;(pageData as any).networkFontFiles = networkFontFiles
    ;(pageData as any).hasAdobeFonts = typographyData.hasAdobeFonts || hasNetworkAdobeFonts

    // Store comprehensive typography extraction result
    ;(pageData as any).typographyExtraction = typographyExtraction

    await context.close()

    return pageData as ExtendedPageData
  } catch (error) {
    console.error(`Playwright crawl error for ${url}:`, error)
    if (page) {
      await page.context().close()
    }
    return null
  }
}

/**
 * Resolve font names from CSS variables and cross-reference with detected fonts
 */
function resolveFontData(data: any): { computedFonts: Record<string, ComputedFontInfo> } {
  const { computedFonts, cssVariables, loadedFonts, googleFonts, fontFaceDeclarations } = data
  const resolved: Record<string, ComputedFontInfo> = {}

  /**
   * Recursively resolve CSS variable references
   */
  const resolveVariable = (value: string, depth = 0): string => {
    if (depth > 5) return value // Prevent infinite recursion
    if (!value || !value.includes('var(')) return value

    const varMatch = value.match(/var\(([^),]+)(?:,\s*([^)]+))?\)/)
    if (!varMatch) return value

    const varName = varMatch[1].trim()
    const fallback = varMatch[2]?.trim()

    // Try to resolve from collected CSS variables
    let resolved = cssVariables[varName]
    if (resolved) {
      // Recursively resolve if result also contains var()
      return resolveVariable(resolved, depth + 1)
    }

    // Use fallback if available
    if (fallback) {
      return resolveVariable(fallback, depth + 1)
    }

    return value
  }

  for (const [role, fontData] of Object.entries(computedFonts)) {
    if (!fontData) continue

    const fd = fontData as any
    let fontName = fd.fontFamily

    // Step 1: Resolve CSS variables (with recursion support)
    if (fontName.includes('var(')) {
      fontName = resolveVariable(fontName)
      // Extract first font from the resolved stack
      if (!fontName.includes('var(')) {
        fontName = fontName.split(',')[0].trim().replace(/['"]/g, '')
      }
    }

    // Step 2: If still unresolved or unknown, try loaded fonts
    if (fontName.includes('var(') || fontName.startsWith('--') || fontName === 'Unknown' || fontName === '') {
      // Try to find a matching loaded font
      if (loadedFonts.length > 0) {
        // Use first custom (non-system) loaded font
        fontName = loadedFonts[0]
      } else if (googleFonts.length > 0) {
        // Fallback to Google Fonts if available
        fontName = googleFonts[0]
      } else if (fontFaceDeclarations.length > 0) {
        // Fallback to @font-face fonts
        fontName = fontFaceDeclarations[0]
      } else {
        // Last resort: use "Custom Font (unidentified)"
        fontName = 'Custom Font (unidentified)'
      }
    }

    // Step 3: Cross-reference with Google Fonts (most reliable)
    const rawStack = fd.rawStack || ''
    const googleMatch = googleFonts.find((gf: string) =>
      rawStack.toLowerCase().includes(gf.toLowerCase()) ||
      fontName.toLowerCase().includes(gf.toLowerCase())
    )
    if (googleMatch) {
      fontName = googleMatch
    }

    // Step 4: Check against @font-face declarations
    if (!googleMatch && fontName !== 'Custom Font (unidentified)') {
      const fontFaceMatch = fontFaceDeclarations.find((ff: string) =>
        rawStack.toLowerCase().includes(ff.toLowerCase()) ||
        fontName.toLowerCase().includes(ff.toLowerCase())
      )
      if (fontFaceMatch) {
        fontName = fontFaceMatch
      }
    }

    resolved[role] = {
      fontFamily: fontName,
      fontWeight: fd.fontWeight,
      fontSize: fd.fontSize,
      lineHeight: fd.lineHeight,
      letterSpacing: fd.letterSpacing,
      element: fd.element
    }
  }

  return { computedFonts: resolved }
}

/**
 * Check if Playwright is available
 */
export async function isPlaywrightAvailable(): Promise<boolean> {
  try {
    const browserInstance = await getBrowser()
    return browserInstance.isConnected()
  } catch {
    return false
  }
}
