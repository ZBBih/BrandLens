/**
 * PDF rendering tests (G8). Uses the content-stream technique from the audit
 * (fable/pdf-glyphs2.mjs): inflate every stream, then inspect the embedded
 * font names and ToUnicode maps to prove non-Latin text is drawn with real
 * glyphs rather than mapped to WinAnsi garbage in Helvetica.
 */

import zlib from 'node:zlib'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { renderBrandReportPdf } from './generator'
import { resetRemoteAssetFailures } from './fonts'
import { DEMO_REPORT } from '../demo/data'
import { log } from '../log'
import type { BrandReport } from '../extractors/types'

const report: BrandReport = {
  ...DEMO_REPORT,
  brandName: 'Café Zürich 東京の会社 🚀',
  tone: {
    ...DEMO_REPORT.tone,
    traits: ['Łódź', 'Москва', 'Ελλάδα', 'Tiếng Việt', '東京の会社', 'Launch 🚀 today'],
  },
  consistency: {
    ...DEMO_REPORT.consistency!,
    score: 62,
    grade: null,
    breakdown: {
      ...DEMO_REPORT.consistency!.breakdown,
      tone: { score: null, max: 25, status: 'insufficient_data', reason: 'no tone of voice could be determined' },
    },
    insufficientData: ['pages: only 2 pages crawled; at least 3 are needed for a grade'],
  },
  colors: {
    colors: [
      { ...DEMO_REPORT.colors.colors[0], source: 'third_party', confidence: 70 },
      ...DEMO_REPORT.colors.colors.slice(1),
    ],
  },
}

/** Inflate every stream of a PDF and return them as latin1 text */
function pdfStreams(buf: Buffer): string[] {
  const s = buf.toString('latin1')
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  const out: string[] = []
  let m
  while ((m = re.exec(s))) {
    const raw = Buffer.from(m[1], 'latin1')
    try {
      out.push(zlib.inflateSync(raw).toString('latin1'))
    } catch {
      out.push(raw.toString('latin1'))
    }
  }
  return out
}

function baseFonts(buf: Buffer): string[] {
  return [...new Set([...buf.toString('latin1').matchAll(/\/BaseFont\s*\/([A-Za-z0-9+-]+)/g)].map(x => x[1]))]
}

/**
 * Map each embedded Type0 font's BaseFont name to the Unicode values of its
 * ToUnicode CMap, so a code point can be tied to the font file that drew it.
 */
function fontUnicodeMap(buf: Buffer): Map<string, Set<string>> {
  const s = buf.toString('latin1')
  const objects = new Map<string, string>()
  for (const m of s.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objects.set(m[1], m[2])
  const result = new Map<string, Set<string>>()
  for (const body of objects.values()) {
    if (!/\/Subtype\s*\/Type0/.test(body)) continue
    const name = /\/BaseFont\s*\/([A-Za-z0-9+-]+)/.exec(body)?.[1]
    const ref = /\/ToUnicode\s+(\d+) 0 R/.exec(body)?.[1]
    const cmapObj = ref ? objects.get(ref) : undefined
    if (!name || !cmapObj) continue
    const cmap = pdfStreams(Buffer.from(cmapObj, 'latin1')).join('\n')
    const values = new Set([...cmap.matchAll(/<([0-9a-fA-F]{4,})>/g)].map(m => m[1].toLowerCase()))
    result.set(name.replace(/^[A-Z]{6}\+/, ''), values)
  }
  return result
}

function fontsDrawing(map: Map<string, Set<string>>, cp: string): string[] {
  return [...map].filter(([, values]) => values.has(cp)).map(([name]) => name)
}

/** Every Unicode value (UTF-16BE hex) that appears in the ToUnicode CMaps */
function toUnicodeValues(streams: string[]): Set<string> {
  const values = new Set<string>()
  for (const s of streams.filter(x => x.includes('begincmap'))) {
    for (const m of s.matchAll(/<([0-9a-fA-F]{4,})>/g)) values.add(m[1].toLowerCase())
  }
  return values
}

async function isOnline(): Promise<boolean> {
  try {
    const res = await fetch('https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-400-normal.woff', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}

describe('renderBrandReportPdf', () => {
  let online = false
  beforeAll(async () => {
    online = await isOnline()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetRemoteAssetFailures()
  })

  it('renders Latin, Cyrillic, Greek and Vietnamese with embedded Noto glyphs when the CDN is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {})

    const buf = await renderBrandReportPdf(report)
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')

    const fonts = baseFonts(buf)
    expect(fonts.some(f => /NotoSans/i.test(f))).toBe(true)
    expect(fonts.some(f => /Helvetica/i.test(f))).toBe(false)

    const streams = pdfStreams(buf)
    const unicode = toUnicodeValues(streams)
    for (const cp of ['00e9', '00fc', '0141', '00f3', '017a', '041c', '0441', '0395', '1ebf', '1ec7']) {
      expect(unicode, `U+${cp} should map to a real glyph`).toContain(cp)
    }
    // Each script is drawn from its own subset file, not from the Latin file
    // with mismatched glyph ids (pdfkit merges fonts that share a name)
    const byFont = fontUnicodeMap(buf)
    expect(fontsDrawing(byFont, '041c').length).toBeGreaterThan(0)
    expect(fontsDrawing(byFont, '041c').every(n => n.endsWith('-cyrillic'))).toBe(true)
    expect(fontsDrawing(byFont, '0395').every(n => n.endsWith('-greek'))).toBe(true)
    expect(fontsDrawing(byFont, '0141').every(n => n.endsWith('-latinext'))).toBe(true)
    expect(fontsDrawing(byFont, '1ebf').every(n => /-(vietnamese|latinext)$/.test(n))).toBe(true)
    // Text is drawn with glyph ids (hex strings), not WinAnsi literal strings
    const textOps = streams.flatMap(s => s.match(/<[0-9a-fA-F]+>\s*Tj|\([^)]*\)\s*Tj|\[[^\]]*\]\s*TJ/g) ?? [])
    expect(textOps.length).toBeGreaterThan(0)
    expect(textOps.every(op => !/^\(/.test(op))).toBe(true)
    // CJK could not be loaded: replaced, never garbled, and logged
    expect(unicode).not.toContain('6771')
    expect(warn).toHaveBeenCalledWith('pdf.cjk_font_unavailable', expect.objectContaining({ variant: expect.any(String) }))
  }, 60_000)

  it('renders CJK and emoji when the CDN is reachable', async (ctx) => {
    if (!online) ctx.skip()
    const buf = await renderBrandReportPdf(report)
    const streams = pdfStreams(buf)
    const unicode = toUnicodeValues(streams)
    expect(unicode).toContain('6771') // 東
    expect(unicode).toContain('306e') // の
    expect(unicode).toContain('041c') // М
    expect(baseFonts(buf).some(f => /NotoSans(JP|SC)/i.test(f))).toBe(true)
    expect(buf.toString('latin1')).toMatch(/\/Subtype\s*\/Image/) // Twemoji 🚀
  }, 90_000)

  it('renders the demo report with a numeric grade', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    const buf = await renderBrandReportPdf(DEMO_REPORT)
    expect(buf.length).toBeGreaterThan(1000)
  }, 60_000)
})
