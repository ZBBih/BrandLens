import { describe, it, expect } from 'vitest'
import {
  generateTailwindConfig,
  generateCssVariables,
  generateCoolorsUrl,
  generateGoogleFontsUrl,
  generateFontImport,
  generateDesignTokens,
  generateMarkdownReport,
  generateJsonExport,
  cssString,
} from './index'
import { normalizeConsistencyData } from './consistency'
import { DEMO_REPORT } from '../demo/data'
import type { ColorEntry, FontEntry } from '../extractors/types'

const color = (hex: string, role: ColorEntry['role']): ColorEntry => ({
  hex, rgb: { r: 0, g: 0, b: 0 }, role, confidence: 80, source: 'extracted', evidence: [],
})
const font = (name: string, role: FontEntry['role'], extra: Partial<FontEntry> = {}): FontEntry => ({
  name, role, confidence: 80, source: 'extracted', evidence: [], ...extra,
})

const colors = [
  color('#635bff', 'primary'),
  color('#00d4ff', 'accent'),
  color('#ff5996', 'accent'),
  color('#0a2540', 'text'),
  color('#abcdef', 'other'),
  color('#123456', 'other'),
  color('not-a-hex', 'other'),
]

const fonts = [
  font('Inter', 'primary', { googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter', variants: ['400', '600', '700;900&family=Evil', 'bold'] }),
  font("Evil'); } body{background:url(//x)} /*", 'heading'),
  font('Söhne Mono', 'secondary'),
  font('Source Serif 4', 'secondary', { googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Source+Serif+4' }),
]

describe('generateTailwindConfig', () => {
  it('keeps same-role colours with ordinals and drops invalid hex', () => {
    const out = generateTailwindConfig(colors)
    expect(out).toContain("'primary': '#635bff'")
    expect(out).toContain("'accent': '#00d4ff'")
    expect(out).toContain("'accent-2': '#ff5996'")
    expect(out).toContain("'other': '#abcdef'")
    expect(out).toContain("'other-2': '#123456'")
    expect(out).not.toContain('not-a-hex')
  })
})

describe('generateCssVariables', () => {
  it('emits no duplicate variables and escapes font names', () => {
    const out = generateCssVariables(colors, fonts)
    const names = [...out.matchAll(/^\s+(--[\w-]+):/gm)].map(m => m[1])
    expect(new Set(names).size).toBe(names.length)
    expect(out).toContain('--color-accent-2: #ff5996;')
    expect(out).toContain("--font-primary: 'Inter', sans-serif;")
    expect(out).toContain("--font-heading: 'Evil\\'); } body{background:url(//x)} /*', sans-serif;")
    expect(out).toContain("--font-secondary: 'Söhne Mono', monospace;")
    expect(out).toContain("--font-secondary-2: 'Source Serif 4', serif;")
    expect(out.split('\n').filter(l => l.includes('--font-heading'))).toHaveLength(1)
  })

  it('cssString escapes quotes, backslashes and control characters', () => {
    expect(cssString("a'b\\c\nd")).toBe("'a\\'b\\\\c d'")
  })
})

describe('generateCoolorsUrl', () => {
  it('uses up to 5 valid colours', () => {
    expect(generateCoolorsUrl(colors)).toBe('https://coolors.co/635bff-00d4ff-ff5996-0a2540-abcdef')
  })
})

describe('Google Fonts generators', () => {
  it('only include fonts served by Google Fonts, with whitelisted weights', () => {
    expect(generateGoogleFontsUrl(fonts)).toBe(
      'https://fonts.google.com/share?selection.family=Inter:wght@400;600|Source+Serif+4:wght@400;600;700'
    )
    expect(generateFontImport(fonts)).toBe(
      "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Source+Serif+4:wght@400;600;700&display=swap');"
    )
  })

  it('returns empty output when no Google font is present', () => {
    expect(generateGoogleFontsUrl([font('Söhne', 'primary')])).toBe('')
    expect(generateFontImport([font('Söhne', 'primary')])).toMatch(/^\/\*/)
  })
})

describe('generateDesignTokens', () => {
  it('produces DTCG JSON with $type/$value and safe token names', () => {
    const json = JSON.parse(generateDesignTokens(colors, fonts, 'Acme'))
    expect(Object.keys(json)).toEqual(['color', 'font'])
    expect(json.color.primary).toEqual({ $type: 'color', $value: '#635bff', $description: 'Acme primary colour (extracted, 80% confidence)' })
    expect(json.color['accent-2'].$value).toBe('#ff5996')
    expect(json.font.primary).toMatchObject({ $type: 'fontFamily', $value: ['Inter', 'sans-serif'] })
    expect(json.font['secondary-2'].$value).toEqual(['Source Serif 4', 'serif'])

    const walk = (node: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$')) continue
        expect(key).not.toMatch(/[.{}]/)
        const v = value as Record<string, unknown>
        if ('$value' in v) {
          expect(['color', 'fontFamily']).toContain(v.$type)
          if (v.$type === 'color') expect(v.$value).toMatch(/^#[0-9a-f]{6}$/)
        } else {
          walk(v)
        }
      }
    }
    walk(json)
  })
})

describe('generateMarkdownReport / generateJsonExport', () => {
  it('renders the demo report', () => {
    const md = generateMarkdownReport(DEMO_REPORT)
    expect(md).toContain('**Brand Health Score:** A (95/100)')
    expect(JSON.parse(generateJsonExport(DEMO_REPORT)).brandName).toBe('Nike')
  })

  it('says when there is not enough data for a grade', () => {
    const md = generateMarkdownReport({
      ...DEMO_REPORT,
      consistency: { ...DEMO_REPORT.consistency!, grade: null, score: 40 },
    })
    expect(md).toContain('Not enough data for a grade')
  })
})

describe('normalizeConsistencyData', () => {
  it('upgrades legacy numeric breakdowns', () => {
    const data = normalizeConsistencyData({ score: 95, grade: 'A', breakdown: { color: 24, typography: 20, tone: 24, seo: 14, message: 13 }, issues: [] })!
    expect(data.breakdown.color).toEqual({ score: 24, max: 25, status: 'scored' })
    expect(data.insufficientData).toEqual([])
  })
})
