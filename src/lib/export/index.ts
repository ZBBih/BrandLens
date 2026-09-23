/**
 * Export utilities for brand assets
 *
 * Color and font names come from crawled pages, so every generator treats
 * them as untrusted: hex values are validated, font names are escaped for the
 * target syntax, and repeated roles get ordinals (primary, primary-2, ...)
 * instead of silently overwriting each other.
 */

import { ColorEntry, FontEntry, BrandReport } from '../extractors/types'
import { normalizeConsistencyData } from './consistency'

const HEX = /^#[0-9a-f]{6}$/i
const WEIGHT = /^\d{3}$/
const DEFAULT_WEIGHTS = ['400', '600', '700']

/**
 * Assign unique keys per role: first 'primary', then 'primary-2', ...
 */
function withRoleKeys<T extends { role: string }>(items: T[]): { key: string; item: T }[] {
  const counts = new Map<string, number>()
  return items.map(item => {
    const n = (counts.get(item.role) ?? 0) + 1
    counts.set(item.role, n)
    return { key: n === 1 ? item.role : `${item.role}-${n}`, item }
  })
}

function validColors(colors: ColorEntry[]): ColorEntry[] {
  return colors.filter(c => typeof c.hex === 'string' && HEX.test(c.hex))
}

/**
 * Escape a value for use inside a single-quoted CSS string
 */
export function cssString(value: string): string {
  const escaped = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
  return `'${escaped}'`
}

/**
 * Escape a value for use inside a single-quoted JavaScript string
 */
function jsString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\u0000-\u001f\u2028\u2029]/g, ' ')}'`
}

/**
 * Generic CSS family to fall back to for a font name
 */
function genericFamily(name: string): 'serif' | 'sans-serif' | 'monospace' {
  const lower = name.toLowerCase()
  if (/mono|code|courier|consol/.test(lower)) return 'monospace'
  if (/sans/.test(lower)) return 'sans-serif'
  if (/serif|georgia|times|garamond|playfair|merriweather|baskerville|caslon|didot|bodoni/.test(lower)) return 'serif'
  return 'sans-serif'
}

/**
 * Generate Tailwind CSS config for colors
 */
export function generateTailwindConfig(colors: ColorEntry[]): string {
  const entries = withRoleKeys(validColors(colors))

  return `// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
${entries.map(({ key, item }) => `        ${jsString(key)}: '${item.hex.toLowerCase()}',`).join('\n')}
      },
    },
  },
}`
}

/**
 * Generate CSS custom properties (variables)
 */
export function generateCssVariables(colors: ColorEntry[], fonts: FontEntry[]): string {
  const lines: string[] = [':root {']

  // Colors
  for (const { key, item } of withRoleKeys(validColors(colors))) {
    lines.push(`  --color-${key}: ${item.hex.toLowerCase()};`)
  }

  lines.push('')

  // Fonts
  for (const { key, item } of withRoleKeys(fonts.filter(f => f.name?.trim()))) {
    lines.push(`  --font-${key}: ${cssString(item.name.trim())}, ${genericFamily(item.name)};`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Generate Coolors.co URL
 */
export function generateCoolorsUrl(colors: ColorEntry[]): string {
  const hexCodes = validColors(colors)
    .slice(0, 5) // Coolors supports max 5 colors
    .map(c => c.hex.replace('#', '').toLowerCase())
    .join('-')

  return `https://coolors.co/${hexCodes}`
}

/**
 * Fonts that are actually served by Google Fonts, with whitelisted weights
 */
function googleFamilies(fonts: FontEntry[]): { family: string; weights: string[] }[] {
  const seen = new Set<string>()
  const result: { family: string; weights: string[] }[] = []
  for (const font of fonts) {
    if (!font.googleFontsUrl || !font.name?.trim()) continue
    const name = font.name.trim()
    if (seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const weights = [...new Set((font.variants ?? []).filter(v => WEIGHT.test(v)))].sort()
    result.push({
      family: encodeURIComponent(name).replace(/%20/g, '+'),
      weights: weights.length > 0 ? weights : DEFAULT_WEIGHTS,
    })
  }
  return result
}

/**
 * Generate Google Fonts URL
 */
export function generateGoogleFontsUrl(fonts: FontEntry[]): string {
  const families = googleFamilies(fonts).map(f => `${f.family}:wght@${f.weights.join(';')}`)

  if (families.length === 0) return ''

  return `https://fonts.google.com/share?selection.family=${families.join('|')}`
}

/**
 * Generate CSS @import for Google Fonts
 */
export function generateFontImport(fonts: FontEntry[]): string {
  const families = googleFamilies(fonts).map(f => `family=${f.family}:wght@${f.weights.join(';')}`)

  if (families.length === 0) return '/* No Google Fonts detected */'

  return `@import url('https://fonts.googleapis.com/css2?${families.join('&')}&display=swap');`
}

/**
 * Token names may not contain '.', '{', '}' or start with '$' (DTCG)
 */
function tokenName(key: string): string {
  return key.replace(/[.{}$]/g, '-').replace(/\s+/g, '-') || 'token'
}

interface DesignToken {
  $type: 'color' | 'fontFamily'
  $value: string | string[]
  $description?: string
}

/**
 * Generate W3C Design Tokens (DTCG format) JSON, importable by Tokens Studio
 * for Figma in DTCG mode:
 * { "color": { "primary": { "$type": "color", "$value": "#635bff" } },
 *   "font": { "primary": { "$type": "fontFamily", "$value": ["Inter", "sans-serif"] } } }
 */
export function generateDesignTokens(colors: ColorEntry[], fonts: FontEntry[], brandName: string): string {
  const brand = brandName.trim() || 'Brand'
  const tokens: { color: Record<string, DesignToken>; font: Record<string, DesignToken> } = { color: {}, font: {} }

  for (const { key, item } of withRoleKeys(validColors(colors))) {
    tokens.color[tokenName(key)] = {
      $type: 'color',
      $value: item.hex.toLowerCase(),
      $description: `${brand} ${key} color (${item.source}, ${item.confidence}% confidence)`,
    }
  }

  for (const { key, item } of withRoleKeys(fonts.filter(f => f.name?.trim()))) {
    const name = item.name.trim()
    tokens.font[tokenName(key)] = {
      $type: 'fontFamily',
      $value: [name, genericFamily(name)],
      $description: `${brand} ${key} typeface (${item.source}, ${item.confidence}% confidence)`,
    }
  }

  return JSON.stringify(tokens, null, 2)
}

/**
 * Generate full Markdown report
 */
export function generateMarkdownReport(report: BrandReport): string {
  const lines: string[] = []

  lines.push(`# ${report.brandName} Brand Guideline`)
  lines.push('')
  lines.push(`**Domain:** ${report.domain}`)
  lines.push(`**Generated:** ${new Date(report.generatedAt).toLocaleDateString()}`)
  const consistency = normalizeConsistencyData(report.consistency)
  if (consistency) {
    if (consistency.grade !== null && consistency.score !== null) {
      lines.push(`**Brand Health Score:** ${consistency.grade} (${consistency.score}/100)`)
    } else {
      lines.push('**Brand Health Score:** Not enough data for a grade')
    }
  }
  lines.push('')

  // Summary
  lines.push('## Brand Summary')
  lines.push(report.summary.description)
  if (report.summary.valueProposition) {
    lines.push('')
    lines.push(`**Value Proposition:** ${report.summary.valueProposition}`)
  }
  if (report.summary.targetAudience) {
    lines.push(`**Target Audience:** ${report.summary.targetAudience}`)
  }
  if (report.summary.industry) {
    lines.push(`**Industry:** ${report.summary.industry}`)
  }
  lines.push('')

  // Colors
  lines.push('## Color Palette')
  lines.push('')
  lines.push('| Role | Hex | RGB |')
  lines.push('|------|-----|-----|')
  for (const color of report.colors.colors.slice(0, 6)) {
    lines.push(`| ${color.role} | ${color.hex.toUpperCase()} | rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}) |`)
  }
  lines.push('')

  // Typography
  lines.push('## Typography')
  lines.push('')
  for (const font of report.typography.fonts.slice(0, 4)) {
    lines.push(`- **${font.role}:** ${font.name}${font.variants?.length ? ` (${font.variants.join(', ')})` : ''}`)
  }
  lines.push('')

  // Tone & Voice
  lines.push('## Tone & Voice')
  lines.push('')
  lines.push(`**Traits:** ${report.tone.traits.join(', ')}`)
  lines.push('')
  lines.push('### Do')
  for (const item of report.tone.doList) {
    lines.push(`- ${item}`)
  }
  lines.push('')
  lines.push("### Don't")
  for (const item of report.tone.dontList) {
    lines.push(`- ${item}`)
  }
  lines.push('')

  // Social
  if (report.social.links.length > 0) {
    lines.push('## Brand Channels')
    lines.push('')
    for (const link of report.social.links) {
      lines.push(`- **${link.platform}:** ${link.url}`)
    }
    lines.push('')
  }

  // Generated Assets
  if (report.generatedAssets) {
    lines.push('## Generated Marketing Copy')
    lines.push('')
    lines.push('### Elevator Pitch')
    lines.push(report.generatedAssets.elevatorPitch)
    lines.push('')
    lines.push('### Ad Headlines')
    for (const headline of report.generatedAssets.adHeadlines) {
      lines.push(`- ${headline}`)
    }
    lines.push('')
    lines.push('### Email Subject Lines')
    for (const subject of report.generatedAssets.emailSubjects) {
      lines.push(`- ${subject}`)
    }
    lines.push('')
    lines.push('### CTA Variations')
    for (const cta of report.generatedAssets.ctaVariations) {
      lines.push(`- ${cta}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push(`*Generated by BrandLens - Analyzed ${report.crawlStats.pagesProcessed} pages in ${report.crawlStats.duration.toFixed(1)}s*`)

  return lines.join('\n')
}

/**
 * Generate JSON export
 */
export function generateJsonExport(report: BrandReport): string {
  return JSON.stringify(report, null, 2)
}
