/**
 * Export utilities for brand assets
 */

import { ColorEntry, FontEntry, BrandReport } from '../extractors/types'

/**
 * Generate Tailwind CSS config for colors
 */
export function generateTailwindConfig(colors: ColorEntry[]): string {
  const colorMap: Record<string, string> = {}

  for (const color of colors) {
    const key = color.role === 'other' ? `color-${colors.indexOf(color) + 1}` : color.role
    colorMap[key] = color.hex
  }

  return `// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
${Object.entries(colorMap).map(([key, value]) => `        '${key}': '${value}',`).join('\n')}
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
  for (const color of colors) {
    const key = color.role === 'other' ? `color-${colors.indexOf(color) + 1}` : color.role
    lines.push(`  --color-${key}: ${color.hex};`)
  }

  lines.push('')

  // Fonts
  for (const font of fonts) {
    lines.push(`  --font-${font.role}: '${font.name}', sans-serif;`)
  }

  lines.push('}')

  return lines.join('\n')
}

/**
 * Generate Coolors.co URL
 */
export function generateCoolorsUrl(colors: ColorEntry[]): string {
  const hexCodes = colors
    .slice(0, 5) // Coolors supports max 5 colors
    .map(c => c.hex.replace('#', ''))
    .join('-')

  return `https://coolors.co/${hexCodes}`
}

/**
 * Generate Google Fonts URL
 */
export function generateGoogleFontsUrl(fonts: FontEntry[]): string {
  const families = fonts
    .filter(f => f.googleFontsUrl || !isSystemFont(f.name))
    .map(f => {
      const weights = f.variants?.length ? f.variants.join(';') : '400;600;700'
      return `${f.name.replace(/\s+/g, '+')}:wght@${weights}`
    })

  if (families.length === 0) return ''

  return `https://fonts.google.com/share?selection.family=${families.join('|')}`
}

/**
 * Generate CSS @import for Google Fonts
 */
export function generateFontImport(fonts: FontEntry[]): string {
  const families = fonts
    .filter(f => f.googleFontsUrl || !isSystemFont(f.name))
    .map(f => {
      const weights = f.variants?.length ? f.variants.join(';') : '400;600;700'
      return `family=${f.name.replace(/\s+/g, '+')}:wght@${weights}`
    })

  if (families.length === 0) return '/* No custom fonts detected */'

  return `@import url('https://fonts.googleapis.com/css2?${families.join('&')}&display=swap');`
}

/**
 * Check if font is a system font
 */
function isSystemFont(name: string): boolean {
  const systemFonts = [
    'arial', 'helvetica', 'verdana', 'georgia', 'times', 'times new roman',
    'courier', 'courier new', 'system-ui', '-apple-system', 'segoe ui',
    'roboto', 'helvetica neue', 'sans-serif', 'serif', 'monospace'
  ]
  return systemFonts.includes(name.toLowerCase())
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
  if (report.consistency) {
    lines.push(`**Brand Health Score:** ${report.consistency.grade} (${report.consistency.score}/100)`)
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
