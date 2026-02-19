/**
 * Color extractor - extracts color palette from CSS
 */

import { PageData } from '../crawler'
import { ColorEntry, ColorData, Evidence } from './types'

// Colors to ignore (common defaults) - only filter as keywords, we'll handle near-black/white separately
const IGNORED_COLORS = new Set([
  'transparent', 'inherit', 'initial', 'currentcolor', 'none', 'unset',
])

// Role keywords in CSS variable names
const ROLE_KEYWORDS: Record<string, ColorEntry['role']> = {
  'primary': 'primary',
  'secondary': 'secondary',
  'accent': 'accent',
  'background': 'background',
  'bg': 'background',
  'foreground': 'text',
  'text': 'text',
  'brand': 'primary',
  'main': 'primary',
  'highlight': 'accent',
  'link': 'accent',
  'button': 'primary',
  'btn': 'primary',
  'cta': 'primary',
  'surface': 'background',
  'muted': 'secondary',
}

/**
 * Parse hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # and expand shorthand
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('')
  }
  if (h.length === 8) {
    h = h.slice(0, 6) // Remove alpha
  }
  if (h.length !== 6) {
    return null
  }

  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null
  }

  return { r, g, b }
}

/**
 * Convert RGB to hex
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

/**
 * Parse rgb() or rgba() color string
 * Returns null for colors with low opacity (< 0.5)
 */
function parseRgb(str: string): { r: number; g: number; b: number } | null {
  // Check for rgba with opacity
  const rgbaMatch = str.match(/rgba\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i)
  if (rgbaMatch) {
    const opacity = parseFloat(rgbaMatch[4])
    // Filter out low opacity colors (less than 50% visible)
    if (opacity < 0.5) return null

    const r = parseInt(rgbaMatch[1], 10)
    const g = parseInt(rgbaMatch[2], 10)
    const b = parseInt(rgbaMatch[3], 10)
    if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
      return { r, g, b }
    }
    return null
  }

  const match = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!match) return null

  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)

  if (r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255) {
    return { r, g, b }
  }

  return null
}

/**
 * Parse hsl() or hsla() color string
 */
function parseHsl(str: string): { r: number; g: number; b: number } | null {
  const match = str.match(/hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?/i)
  if (!match) return null

  const h = parseFloat(match[1]) / 360
  const s = parseFloat(match[2]) / 100
  const l = parseFloat(match[3]) / 100

  // HSL to RGB conversion
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

/**
 * Parse any color format to RGB
 */
function parseColor(value: string): { r: number; g: number; b: number } | null {
  const trimmed = value.trim().toLowerCase()

  if (IGNORED_COLORS.has(trimmed)) {
    return null
  }

  // Try hex
  if (trimmed.startsWith('#')) {
    return hexToRgb(trimmed)
  }

  // Try rgb/rgba
  if (trimmed.startsWith('rgb')) {
    return parseRgb(trimmed)
  }

  // Try hsl/hsla
  if (trimmed.startsWith('hsl')) {
    return parseHsl(trimmed)
  }

  return null
}

/**
 * Infer color role from CSS variable name or property context
 */
function inferRole(context: string): ColorEntry['role'] {
  const lower = context.toLowerCase()

  for (const [keyword, role] of Object.entries(ROLE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      return role
    }
  }

  return 'other'
}

/**
 * Calculate color distance (for deduplication)
 */
function colorDistance(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  )
}

/**
 * Check if color is pure black or white (exact match or very close)
 */
function isPureBlackOrWhite(rgb: { r: number; g: number; b: number }): boolean {
  // Pure white: all channels at 255 or very close (within 5)
  const isWhite = rgb.r >= 250 && rgb.g >= 250 && rgb.b >= 250
  // Pure black: all channels at 0 or very close (within 5)
  const isBlack = rgb.r <= 5 && rgb.g <= 5 && rgb.b <= 5
  return isWhite || isBlack
}

/**
 * Check if color is too close to black or white (near-grayscale extremes)
 * More aggressive threshold to filter out off-whites and near-blacks
 */
function isNearBlackOrWhite(rgb: { r: number; g: number; b: number }): boolean {
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  // Filter out colors with brightness < 15 (very dark) or > 240 (very light)
  return brightness < 15 || brightness > 240
}

/**
 * Extract CSS custom properties (variables)
 */
function extractCssVariables(css: string, sourceUrl: string): ColorEntry[] {
  const colors: ColorEntry[] = []
  const varRegex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;}\n]+)/g

  let match
  while ((match = varRegex.exec(css)) !== null) {
    const varName = match[1]
    const value = match[2].trim()

    const rgb = parseColor(value)
    if (rgb && !isNearBlackOrWhite(rgb)) {
      colors.push({
        hex: rgbToHex(rgb.r, rgb.g, rgb.b),
        rgb,
        role: inferRole(varName),
        cssVariable: `--${varName}`,
        confidence: 90,
        source: 'extracted',
        evidence: [{
          url: sourceUrl,
          snippet: `--${varName}: ${value}`,
          context: 'CSS custom property',
        }],
      })
    }
  }

  return colors
}

/**
 * Check if color is a gray/neutral (low saturation)
 */
function isGrayColor(rgb: { r: number; g: number; b: number }): boolean {
  const max = Math.max(rgb.r, rgb.g, rgb.b)
  const min = Math.min(rgb.r, rgb.g, rgb.b)
  const diff = max - min
  // If the difference between max and min is small, it's grayish
  return diff < 30
}

/**
 * Brand context patterns (high brand value)
 */
const BRAND_CONTEXT_PATTERNS = [
  /header/i, /nav/i, /navbar/i, /navigation/i,
  /btn/i, /button/i, /cta/i,
  /link/i, /anchor/i,
  /logo/i, /brand/i,
  /hero/i, /banner/i,
  /primary/i, /accent/i,
]

/**
 * Neutral context patterns (body text, generic)
 */
const NEUTRAL_CONTEXT_PATTERNS = [
  /body/i, /paragraph/i, /text/i, /content/i,
  /p\s*\{/i, /p\s*,/i,
  /muted/i, /subtle/i, /secondary/i,
]

/**
 * Extract colors from CSS property values with context awareness
 */
function extractPropertyColors(css: string, sourceUrl: string): ColorEntry[] {
  const colors: ColorEntry[] = []

  // Match CSS rules with their selectors for context
  const ruleRegex = /([^{}]+)\{([^}]+)\}/g

  let ruleMatch
  while ((ruleMatch = ruleRegex.exec(css)) !== null) {
    const selector = ruleMatch[1].trim()
    const declarations = ruleMatch[2]

    // Match color-related properties within this rule
    const propRegex = /(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*([^;}\n]+)/gi

    let match
    while ((match = propRegex.exec(declarations)) !== null) {
      const value = match[1].trim()

      // Skip var() references (handled separately)
      if (value.includes('var(')) {
        continue
      }

      const rgb = parseColor(value)
      if (rgb && !isNearBlackOrWhite(rgb)) {
        const fullMatch = match[0]
        const prop = fullMatch.split(':')[0].trim().toLowerCase()

        // Determine role based on context
        let role: ColorEntry['role'] = 'other'
        let confidence = 70
        const isGray = isGrayColor(rgb)

        // Check if this is a brand context (header, button, link)
        const isBrandContext = BRAND_CONTEXT_PATTERNS.some(p => p.test(selector))
        const isNeutralContext = NEUTRAL_CONTEXT_PATTERNS.some(p => p.test(selector))

        if (prop.includes('background')) {
          if (isBrandContext && !isGray) {
            role = 'primary'
            confidence = 85
          } else {
            role = 'background'
          }
        } else if (prop === 'color') {
          if (isGray || isNeutralContext) {
            role = 'text'
            confidence = 60 // Lower confidence for text colors
          } else if (isBrandContext) {
            role = 'accent'
            confidence = 80
          } else {
            role = 'text'
          }
        }

        colors.push({
          hex: rgbToHex(rgb.r, rgb.g, rgb.b),
          rgb,
          role,
          confidence,
          source: 'extracted',
          evidence: [{
            url: sourceUrl,
            snippet: `${selector} { ${fullMatch} }`.slice(0, 120),
            context: isBrandContext ? 'Brand element CSS' : 'CSS property',
          }],
        })
      }
    }
  }

  return colors
}

/**
 * Group similar colors together - returns the representative color
 * Colors within ~15% RGB difference (distance ~40) are grouped
 */
function groupSimilarColors(colors: ColorEntry[]): Map<string, { entry: ColorEntry; count: number; brandScore: number }> {
  const groups: { entry: ColorEntry; count: number; brandScore: number; rgb: { r: number; g: number; b: number } }[] = []

  for (const color of colors) {
    // Skip pure black/white
    if (isPureBlackOrWhite(color.rgb)) continue

    // Calculate brand score: higher for non-gray colors in brand contexts
    const isGray = isGrayColor(color.rgb)
    let brandScore = color.confidence
    if (isGray) {
      brandScore -= 30 // Penalize grays
    }
    if (color.role === 'primary' || color.role === 'accent') {
      brandScore += 20 // Boost brand colors
    }
    if (color.role === 'text' || color.role === 'background') {
      brandScore -= 15 // Demote text/background colors
    }

    // Find an existing group this color belongs to (within distance of 40 ~15% RGB difference)
    const GROUP_DISTANCE_THRESHOLD = 40
    let foundGroup = false

    for (const group of groups) {
      if (colorDistance(color.rgb, group.rgb) < GROUP_DISTANCE_THRESHOLD) {
        group.count++
        group.brandScore = Math.max(group.brandScore, brandScore)
        // Keep the version with higher confidence/brand score
        if (brandScore > group.brandScore - 10) {
          // Merge evidence
          group.entry.evidence.push(...color.evidence)
          // Upgrade role if we found a more specific one
          if (color.role !== 'other' && color.role !== 'text' && group.entry.role === 'other') {
            group.entry.role = color.role
          }
        }
        foundGroup = true
        break
      }
    }

    if (!foundGroup) {
      groups.push({
        entry: color,
        count: 1,
        brandScore,
        rgb: color.rgb
      })
    }
  }

  // Convert to map for compatibility
  const colorMap = new Map<string, { entry: ColorEntry; count: number; brandScore: number }>()
  for (const group of groups) {
    colorMap.set(group.entry.hex, { entry: group.entry, count: group.count, brandScore: group.brandScore })
  }

  return colorMap
}

/**
 * Deduplicate and rank colors
 */
function dedupeAndRank(colors: ColorEntry[]): ColorEntry[] {
  // First, group similar colors together
  const colorMap = groupSimilarColors(colors)

  // Sort by brand score first, then by frequency, then by role importance
  const result = Array.from(colorMap.values())
    .sort((a, b) => {
      // Non-gray colors first
      const aIsGray = isGrayColor(a.entry.rgb)
      const bIsGray = isGrayColor(b.entry.rgb)
      if (aIsGray !== bIsGray) {
        return aIsGray ? 1 : -1
      }

      // Then by brand score
      if (b.brandScore !== a.brandScore) {
        return b.brandScore - a.brandScore
      }

      // Then by frequency (how many times this color appeared)
      if (b.count !== a.count) {
        return b.count - a.count
      }

      // Then by role importance
      const roleOrder: Record<ColorEntry['role'], number> = {
        primary: 0,
        secondary: 1,
        accent: 2,
        background: 3,
        text: 4,
        other: 5,
      }
      return (roleOrder[a.entry.role] ?? 5) - (roleOrder[b.entry.role] ?? 5)
    })
    .map(({ entry }) => entry)

  // Second pass: remove any remaining similar colors that slipped through
  // Use a higher threshold here (50) to catch any stragglers
  const filtered: ColorEntry[] = []
  for (const color of result) {
    const isTooSimilar = filtered.some(existing =>
      colorDistance(color.rgb, existing.rgb) < 50
    )
    if (!isTooSimilar) {
      filtered.push(color)
    }
  }

  // Assign roles based on ranking - but don't make grays primary
  if (filtered.length > 0) {
    if (filtered[0].role === 'other' && !isGrayColor(filtered[0].rgb)) {
      filtered[0].role = 'primary'
    } else if (filtered[0].role === 'other') {
      filtered[0].role = 'text' // Gray should be text, not primary
    }
  }
  if (filtered.length > 1) {
    if (filtered[1].role === 'other' && !isGrayColor(filtered[1].rgb)) {
      filtered[1].role = 'secondary'
    } else if (filtered[1].role === 'other') {
      filtered[1].role = 'text'
    }
  }
  for (let i = 2; i < filtered.length && i < 5; i++) {
    if (filtered[i].role === 'other') {
      filtered[i].role = isGrayColor(filtered[i].rgb) ? 'text' : 'accent'
    }
  }

  // Limit to top 10 colors max (usually brands have 3-6)
  return filtered.slice(0, 10)
}

/**
 * Extract colors from crawled pages
 */
export function extractColors(
  pages: PageData[],
  cssContents: Map<string, string[]>
): ColorData {
  const allColors: ColorEntry[] = []

  // Extract from CSS
  for (const [pageUrl, cssArray] of cssContents) {
    for (const css of cssArray) {
      // Extract CSS variables first (higher confidence)
      const varColors = extractCssVariables(css, pageUrl)
      allColors.push(...varColors)

      // Extract from property values
      const propColors = extractPropertyColors(css, pageUrl)
      allColors.push(...propColors)
    }
  }

  // Dedupe and rank
  const colors = dedupeAndRank(allColors)

  return { colors }
}
