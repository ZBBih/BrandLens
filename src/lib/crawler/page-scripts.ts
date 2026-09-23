/**
 * Scripts evaluated inside crawled pages by playwright.ts.
 *
 * They are plain JavaScript strings rather than TypeScript functions so no
 * build tool can inject helpers (e.g. esbuild's `__name`) that don't exist in
 * the page. Results are untrusted: see sanitize.ts.
 */

/**
 * Legacy multi-layer font detection (computed fonts for key roles, CSS
 * variables, document.fonts, Google/Adobe/@font-face sources).
 * The caller already waited (bounded) for document.fonts.ready.
 */
export const LEGACY_TYPOGRAPHY_SCRIPT = String.raw`(() => {
  const cleanFontName = (fontStack) => {
    if (!fontStack) return 'Unknown'
    if (fontStack.includes('var(')) return fontStack
    const firstFont = fontStack.split(',')[0].trim()
    return firstFont.replace(/['"]/g, '')
  }

  const systemFonts = [
    'system-ui', '-apple-system', 'blinkmacsystemfont',
    'segoe ui', 'roboto', 'oxygen', 'ubuntu', 'cantarell',
    'fira sans', 'droid sans', 'helvetica neue', 'helvetica',
    'arial', 'sans-serif', 'serif', 'monospace',
    'times new roman', 'times', 'georgia', 'verdana',
    'courier new', 'courier', 'sf pro', 'sf pro display',
    'ui-sans-serif', 'ui-serif', 'ui-monospace'
  ]
  const isSystemFont = (fontName) => systemFonts.some(sf => fontName.toLowerCase().includes(sf))

  const getFontForElement = (selector) => {
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
    }
  }

  // Method 1: computed styles for key elements
  const computedFonts = {}
  const selectors = {
    h1: 'h1',
    h2: 'h2',
    h3: 'h3',
    body: 'p, article p, .body-text, main p, body',
    button: 'button, .btn, [class*="button"], a.btn, input[type="submit"]',
    nav: 'nav a, header a, .nav-link, .navigation a',
    hero: '[class*="hero"] h1, [class*="hero"] h2, .banner h1, .jumbotron h1',
  }
  for (const role of Object.keys(selectors)) {
    const fontData = getFontForElement(selectors[role])
    if (fontData) computedFonts[role] = fontData
  }

  // Method 2: CSS variables from :root and html
  const cssVariables = {}
  try {
    const rootStyles = getComputedStyle(document.documentElement)
    const resolveVar = (value, depth) => {
      depth = depth || 0
      if (depth > 5) return value
      if (!value || !value.includes('var(')) return value
      const varMatch = value.match(/var\(([^),]+)(?:,\s*([^)]+))?\)/)
      if (!varMatch) return value
      const varName = varMatch[1].trim()
      const fallback = varMatch[2] ? varMatch[2].trim() : undefined
      const resolved = rootStyles.getPropertyValue(varName).trim()
      if (resolved) return resolveVar(resolved, depth + 1)
      if (fallback) return resolveVar(fallback, depth + 1)
      return value
    }

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
      if (value) cssVariables[varName] = resolveVar(value)
    })

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
                if (rawValue) cssVariables[prop] = resolveVar(rawValue)
              }
            }
          }
        })
      } catch (e) {
        // Cross-origin stylesheet: rules are not readable, skip it.
      }
    })
  } catch (e) {
    // Computed styles unavailable: leave cssVariables empty.
  }

  // Method 3: loaded fonts from document.fonts
  const loadedFonts = []
  const loadedFontsWithWeights = []
  const iconFontPatterns = [
    'fontawesome', 'font awesome', 'fa-', 'fa solid', 'fa brands', 'fa regular',
    'material', 'icon', 'awb-icons', 'revicons', 'icomoon', 'glyphicon',
    'dashicons', 'eleganticons', 'feather', 'ionicons', 'star'
  ]
  const isIconFont = (name) => {
    const lower = name.toLowerCase()
    return iconFontPatterns.some(p => lower.includes(p))
  }
  try {
    const fontMap = new Map()
    document.fonts.forEach(font => {
      if (font.status === 'loaded') {
        const fontName = font.family.replace(/['"]/g, '')
        if (!isSystemFont(fontName) && !isIconFont(fontName)) {
          if (!fontMap.has(fontName)) fontMap.set(fontName, [])
          fontMap.get(fontName).push(font.weight)
        }
      }
    })
    fontMap.forEach((weights, name) => {
      loadedFonts.push(name)
      loadedFontsWithWeights.push({ name, weights: Array.from(new Set(weights)) })
    })
  } catch (e) {
    // document.fonts unavailable: no loaded-font data.
  }

  // Method 4: Google Fonts from link tags and @import
  const googleFonts = []
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
    const href = link.getAttribute('href') || ''
    const familyMatches = href.match(/family=([^&:]+)/g)
    if (familyMatches) {
      familyMatches.forEach(match => {
        let fontName = match.replace('family=', '').replace(/\+/g, ' ')
        fontName = fontName.split(':')[0].split('@')[0]
        if (!googleFonts.includes(fontName)) googleFonts.push(fontName)
      })
    }
  })
  document.querySelectorAll('style').forEach(style => {
    const text = (style.textContent || '').slice(0, 200000)
    const importMatches = text.match(/@import[^;]*fonts\.googleapis\.com[^;]*/g)
    if (importMatches) {
      importMatches.forEach(imp => {
        const familyMatch = imp.match(/family=([^&:'"]+)/)
        if (familyMatch) {
          const fontName = familyMatch[1].replace(/\+/g, ' ')
          if (!googleFonts.includes(fontName)) googleFonts.push(fontName)
        }
      })
    }
  })

  // Method 5: Adobe Fonts (Typekit)
  const hasAdobeFonts = !!document.querySelector('link[href*="use.typekit.net"]') ||
                        !!document.querySelector('script[src*="use.typekit.net"]')

  // Method 6: @font-face declarations
  const fontFaceDeclarations = []
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
      } catch (e) {
        // Cross-origin stylesheet: rules are not readable, skip it.
      }
    })
  } catch (e) {
    // styleSheets unavailable: no @font-face data.
  }

  const fontSources = []
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
    const href = link.getAttribute('href')
    if (href) fontSources.push({ type: 'google', url: href, fonts: googleFonts })
  })
  if (hasAdobeFonts) {
    const typekitLink = document.querySelector('link[href*="use.typekit.net"]')
    fontSources.push({
      type: 'adobe',
      url: (typekitLink && typekitLink.getAttribute('href')) || 'use.typekit.net'
    })
  }
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
})()`

/**
 * All same-origin stylesheet texts plus <style> contents.
 */
export const STYLESHEETS_SCRIPT = String.raw`(() => {
  const sheets = []
  for (const sheet of Array.from(document.styleSheets).slice(0, 200)) {
    try {
      if (sheet.cssRules) {
        const rules = []
        for (const rule of sheet.cssRules) rules.push(rule.cssText)
        sheets.push(rules.join('\n'))
      }
    } catch (e) {
      // Cross-origin stylesheet: rules are not readable, skip it.
    }
  }
  document.querySelectorAll('style').forEach((style) => {
    if (style.textContent) sheets.push(style.textContent)
  })
  return sheets
})()`

/**
 * Rendered colour areas (improve-project "Rank colours by rendered area").
 *
 * For visible elements whose box intersects the first two viewport heights:
 * - background-color (alpha >= 0.5) gets the clipped box area;
 * - color gets approx text area (own text length x fontSize^2 x 0.5, scaled
 *   by the visible fraction, capped at the clipped box area);
 * - border-*-color gets side length x border width when the width > 0.
 * The page canvas colour (body, else html background) counts for the whole
 * region. Colours are normalised to sRGB '#rrggbb'; non-rgb() values such as
 * oklch()/lab()/color() go through a 1x1 canvas.
 */
export function colorAreasScript(maxElements: number): string {
  const limit = Math.max(1, Math.min(20_000, Math.floor(maxElements)))
  return String.raw`(() => {
  const MAX_ELEMENTS = ` + limit + String.raw`
  const vw = window.innerWidth || document.documentElement.clientWidth || 0
  const limitY = (window.innerHeight || document.documentElement.clientHeight || 0) * 2
  const areas = {}
  const cache = new Map()
  let ctx = null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  } catch (e) {
    ctx = null
  }

  const hex2 = (n) => (n < 16 ? '0' : '') + n.toString(16)
  // Returns '#rrggbb' or null when transparent / alpha < 0.5 / unparseable.
  const toHex = (value) => {
    if (!value || value === 'transparent') return null
    if (cache.has(value)) return cache.get(value)
    let out = null
    const m = value.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+)(%?))?\s*\)$/)
    if (m) {
      let a = m[4] === undefined ? 1 : parseFloat(m[4])
      if (m[5] === '%') a = a / 100
      if (a >= 0.5) {
        out = '#' + [m[1], m[2], m[3]].map(v => hex2(Math.max(0, Math.min(255, Math.round(parseFloat(v)))))).join('')
      }
    } else if (ctx) {
      try {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = '#000000'
        ctx.fillStyle = value
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
        if (d[3] >= 128) out = '#' + hex2(d[0]) + hex2(d[1]) + hex2(d[2])
      } catch (e) {
        out = null
      }
    }
    cache.set(value, out)
    return out
  }
  const add = (color, area) => {
    if (!color || !(area > 0)) return
    areas[color] = (areas[color] || 0) + area
  }

  const all = document.body ? document.body.getElementsByTagName('*') : []
  const n = Math.min(all.length, MAX_ELEMENTS)
  const bodyStyle = document.body ? getComputedStyle(document.body) : null
  const htmlStyle = getComputedStyle(document.documentElement)
  const canvasBg = (bodyStyle && toHex(bodyStyle.backgroundColor)) || toHex(htmlStyle.backgroundColor)
  if (canvasBg) add(canvasBg, vw * limitY)

  for (let i = 0; i < n; i++) {
    const el = all[i]
    const rect = el.getBoundingClientRect()
    if (!(rect.width > 0 && rect.height > 0)) continue
    if (rect.bottom <= 0 || rect.top >= limitY || rect.right <= 0 || rect.left >= vw) continue
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue

    const cw = Math.min(vw, rect.right) - Math.max(0, rect.left)
    const ch = Math.min(limitY, rect.bottom) - Math.max(0, rect.top)
    if (!(cw > 0 && ch > 0)) continue
    const clipped = cw * ch
    const fraction = clipped / (rect.width * rect.height)

    add(toHex(style.backgroundColor), clipped)

    let textLen = 0
    for (const node of el.childNodes) {
      if (node.nodeType === 3) textLen += (node.nodeValue || '').trim().length
    }
    if (textLen > 0) {
      const fs = parseFloat(style.fontSize) || 16
      add(toHex(style.color), Math.min(textLen * fs * fs * 0.5 * fraction, clipped))
    }

    const sides = [['Top', cw], ['Bottom', cw], ['Left', ch], ['Right', ch]]
    for (const [side, len] of sides) {
      const w = parseFloat(style['border' + side + 'Width']) || 0
      const bs = style['border' + side + 'Style']
      if (w > 0 && bs !== 'none' && bs !== 'hidden') {
        add(toHex(style['border' + side + 'Color']), len * w)
      }
    }
  }

  const out = {}
  for (const k of Object.keys(areas)) out[k] = Math.round(areas[k])
  return out
})()`
}
