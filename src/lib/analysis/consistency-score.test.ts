import { describe, it, expect } from 'vitest'
import {
  calculateConsistencyScore,
  extractPageColors,
  extractPageFonts,
  normalizeConsistencyData,
} from './consistency-score'
import { createVarResolver, collectCssVariables } from '../extractors/colors'
import { makePage, cssMap } from '../extractors/__fixtures__/pages'
import type { ColorEntry, FontEntry, ToneData } from '../extractors/types'

const tone: ToneData = {
  traits: ['confident', 'clear'],
  doList: [],
  dontList: [],
  sampleHeadlines: [],
  sampleCtas: [],
  styleNotes: [],
  confidence: 70,
  source: 'inferred',
  evidence: [],
}

const color = (hex: string, role: ColorEntry['role']): ColorEntry => ({
  hex,
  rgb: { r: 0, g: 0, b: 0 },
  role,
  confidence: 80,
  source: 'extracted',
  evidence: [],
})

const font = (name: string, role: FontEntry['role']): FontEntry => ({
  name,
  role,
  confidence: 80,
  source: 'extracted',
  evidence: [],
})

describe('calculateConsistencyScore', () => {
  it('gives no grade (not 100/A) for a 1-page crawl with no colors or fonts', async () => {
    const page = makePage({ url: 'https://tiny.test/' })
    const result = await calculateConsistencyScore([page], cssMap({}), [], [], { ...tone, traits: [] })

    expect(result.grade).toBeNull()
    expect(result.score).toBeNull()
    expect(result.pagesAnalyzed).toBe(1)
    for (const dim of ['color', 'typography', 'tone', 'seo', 'message'] as const) {
      expect(result.breakdown[dim].status).toBe('insufficient_data')
      expect(result.breakdown[dim].score).toBeNull()
      expect(result.breakdown[dim].reason).toBeTruthy()
    }
    expect(result.insufficientData[0]).toMatch(/^pages: only 1 page crawled/)
    expect(result.insufficientData.some(r => r.startsWith('color:'))).toBe(true)
    expect(result.insufficientData.some(r => r.startsWith('typography:'))).toBe(true)
  })

  it('gives a numeric grade for a healthy 5-page site', async () => {
    const paths = ['/', '/about', '/blog', '/pricing', '/contact']
    const css = ':root{--font-sans:"Inter", sans-serif; --brand:#635bff} body{font-family:var(--font-sans);color:#111} .btn{background:var(--brand)} h1{color:rgb(99 91 255)}'
    const pages = paths.map((p, i) => makePage({
      url: `https://acme.test${p}`,
      title: `Page ${i} | Acme`,
      description: 'Acme builds payment infrastructure for the internet economy.',
      headings: [{ level: 1, text: i === 0 ? 'Payment infrastructure for the internet' : `Acme payment infrastructure ${p}` }],
      ctaButtons: ['Start now'],
    }))
    const result = await calculateConsistencyScore(
      pages,
      cssMap(Object.fromEntries(pages.map(p => [p.url, [css]]))),
      [color('#635bff', 'primary'), color('#111111', 'text')],
      [font('Inter', 'primary')],
      tone
    )

    expect(result.grade).not.toBeNull()
    expect(result.score).toBeGreaterThanOrEqual(90)
    for (const dim of ['color', 'typography', 'tone', 'seo', 'message'] as const) {
      expect(result.breakdown[dim].status).toBe('scored')
    }
    expect(result.insufficientData).toEqual([])
    // var(--font-sans) resolves to Inter, so it is not reported as a non-brand font
    expect(result.issues.some(i => i.includes('non-brand font'))).toBe(false)
  })

  it('withholds the grade when fewer than 3 dimensions can be scored', async () => {
    const pages = ['/', '/a', '/b'].map(p => makePage({ url: `https://x.test${p}`, title: 'X' }))
    const result = await calculateConsistencyScore(pages, cssMap({}), [], [], { ...tone, traits: [] })
    expect(result.grade).toBeNull()
    expect(typeof result.score).toBe('number') // seo is scored, message is not
    expect(result.insufficientData.some(r => r.startsWith('dimensions:'))).toBe(true)
  })

  it('does not count a core message with no significant words as a hit, and has no floors', async () => {
    const pages = [
      makePage({ url: 'https://x.test/', headings: [{ level: 1, text: 'we do it all for you' }], ctaButtons: ['go'] }),
      makePage({ url: 'https://x.test/a', headings: [{ level: 1, text: 'Something unrelated entirely' }] }),
      makePage({ url: 'https://x.test/b', headings: [{ level: 1, text: 'Different wording elsewhere' }] }),
    ]
    const result = await calculateConsistencyScore(pages, cssMap({}), [], [], tone)
    expect(result.breakdown.message.status).toBe('insufficient_data')

    const pages2 = [
      makePage({ url: 'https://x.test/', headings: [{ level: 1, text: 'Payments infrastructure platform' }] }),
      makePage({ url: 'https://x.test/a', headings: [{ level: 1, text: 'Something unrelated entirely' }] }),
    ]
    const result2 = await calculateConsistencyScore(pages2, cssMap({}), [], [], tone)
    expect(result2.breakdown.message).toMatchObject({ status: 'scored', score: 0 })
  })
})

describe('page helpers', () => {
  it('extractPageColors counts inline style colors and modern syntax', () => {
    const colors = extractPageColors(
      '<p style="color: oklch(0.62 0.21 259)">x</p><div style=\'background:#E11D48\'></div>',
      '.a{border:1px solid rgb(37 99 235 / var(--tw-border-opacity))}'
    )
    expect(colors.has('#e11d48')).toBe(true)
    expect(colors.has('#2563eb')).toBe(true)
    expect(colors.size).toBe(3)
  })

  it('extractPageFonts resolves var() and ignores what it cannot resolve', () => {
    const css = ':root{--font-sans:"Inter var", system-ui} body{font-family:var(--font-sans)} .x{font-family:var(--missing)} .y{font:600 16px/1.4 "Söhne", sans-serif}'
    const resolve = createVarResolver(collectCssVariables([css]))
    expect([...extractPageFonts(css, resolve)].sort()).toEqual(['inter var', 'söhne'])
    expect([...extractPageFonts(css)]).toEqual(['söhne'])
  })
})

describe('normalizeConsistencyData', () => {
  it('upgrades legacy numeric breakdowns', () => {
    const legacy = { score: 95, grade: 'A', breakdown: { color: 24, typography: 20, tone: 24, seo: 14, message: 13 }, issues: [] }
    const data = normalizeConsistencyData(legacy)!
    expect(data.breakdown.color).toEqual({ score: 24, max: 25, status: 'scored' })
    expect(data.grade).toBe('A')
    expect(data.insufficientData).toEqual([])
  })
})
