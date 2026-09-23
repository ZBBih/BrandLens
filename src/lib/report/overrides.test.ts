import { describe, expect, it } from 'vitest'
import type { BrandReport, ColorEntry, FontEntry } from '../extractors/types'
import { applyOverrides } from './overrides'

const color = (hex: string, role: ColorEntry['role']): ColorEntry => ({
  hex,
  rgb: { r: 0, g: 0, b: 0 },
  role,
  confidence: 80,
  source: 'extracted',
  evidence: [],
})

const font = (name: string): FontEntry => ({ name, role: 'primary', confidence: 80, source: 'extracted', evidence: [], googleFontsUrl: 'https://fonts.google.com/x' })

const report = {
  brandName: 'Acme',
  summary: { name: 'Acme' },
  colors: { colors: [color('#111111', 'primary'), color('#eeeeee', 'background'), color('#ff0000', 'accent')] },
  typography: { fonts: [font('Wrong Sans'), font('Arial')] },
} as unknown as BrandReport

describe('applyOverrides', () => {
  it('returns the report untouched without overrides', () => {
    expect(applyOverrides(report, undefined)).toBe(report)
  })

  it('edits, re-roles and hides colours without mutating the original', () => {
    const edited = applyOverrides(report, {
      colors: {
        '#111111': { hex: '#635bff' },
        '#eeeeee': { role: 'text' },
        '#ff0000': { hidden: true },
      },
    })
    expect(edited.colors.colors.map(c => [c.hex, c.role])).toEqual([
      ['#635bff', 'primary'],
      ['#eeeeee', 'text'],
    ])
    expect(edited.colors.colors[0].rgb).toEqual({ r: 0x63, g: 0x5b, b: 0xff })
    expect(report.colors.colors).toHaveLength(3)
  })

  it('renames fonts (dropping the stale Google Fonts link) and hides others', () => {
    const edited = applyOverrides(report, { fonts: { 'Wrong Sans': { name: 'Inter' }, Arial: { hidden: true } } })
    expect(edited.typography.fonts).toHaveLength(1)
    expect(edited.typography.fonts[0]).toMatchObject({ name: 'Inter', googleFontsUrl: undefined, userEdited: true })
  })

  it('renames the brand everywhere it is shown', () => {
    const edited = applyOverrides(report, { brandName: 'Acme Corp' })
    expect(edited.brandName).toBe('Acme Corp')
    expect(edited.summary.name).toBe('Acme Corp')
  })
})
