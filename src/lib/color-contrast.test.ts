import { describe, expect, it } from 'vitest'
import { contrastRatio, ensureContrast, readableTextOn, safeHex, INK, PAPER } from './color-contrast'

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
    // white on Tailwind blue-500, the old hero fallback
    expect(contrastRatio('#ffffff', '#3b82f6')).toBeCloseTo(3.68, 1)
  })
})

describe('readableTextOn', () => {
  it('picks dark text on light brand colors and white on dark ones', () => {
    expect(readableTextOn('#ffd700')).toBe(INK) // gold
    expect(readableTextOn('#fef9c3')).toBe(INK) // pastel yellow
    expect(readableTextOn('#1e3a8a')).toBe(PAPER) // navy
  })

  it('always reaches AA for normal text', () => {
    for (const bg of ['#ffd700', '#3b82f6', '#22c55e', '#ef4444', '#a855f7', '#111111', '#f5f5f5', '#ff6600']) {
      expect(contrastRatio(readableTextOn(bg), bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('ensureContrast', () => {
  it('keeps colors that already pass', () => {
    expect(ensureContrast('#1e40af', '#ffffff')).toBe('#1e40af')
  })

  it('darkens a brand color that is too light for a white background', () => {
    const adjusted = ensureContrast('#facc15', '#ffffff')
    expect(contrastRatio(adjusted, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('handles brand text on a tint of itself', () => {
    const adjusted = ensureContrast('#3b82f6', '#eef4fe')
    expect(contrastRatio(adjusted, '#eef4fe')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('safeHex', () => {
  it('normalizes valid input and rejects anything else', () => {
    expect(safeHex('#ABC', '#000000')).toBe('#aabbcc')
    expect(safeHex('red; background:url(x)', '#000000')).toBe('#000000')
    expect(safeHex(undefined, '#123456')).toBe('#123456')
  })
})
