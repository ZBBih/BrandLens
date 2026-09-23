/**
 * Accuracy eval harness (improve-project P-5).
 *
 * Runs the real extractors (extractColors, extractTypography, extractLogo)
 * over captured crawl snapshots and scores them against hand-checked ground
 * truth in expected.json:
 * - primary colour: rank 1 or 2 is within CIEDE2000 < 10 of an accepted value
 * - primary font: rank 1 or 2 matches an accepted family (case/space-insensitive)
 * - logo: a logo URL was found
 *
 * Snapshot format (scripts/eval/snapshots/<domain>.json.gz):
 * { capturedAt, finalUrl, pages: PageData[], cssContents: Record<string, string[]> }
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { differenceCiede2000 } from 'culori'
import { extractColors } from '../../src/lib/extractors/colors'
import { extractTypography } from '../../src/lib/extractors/typography'
import { extractLogo } from '../../src/lib/extractors/logo'
import type { PageData } from '../../src/lib/crawler'

export interface ExpectedFact {
  values: string[]
  source: string
}

export interface ExpectedBrand {
  name: string
  domain: string
  primaryColors: ExpectedFact
  primaryFonts: ExpectedFact
}

export interface ExpectedFile {
  brands: ExpectedBrand[]
}

export interface Snapshot {
  capturedAt: string
  finalUrl: string
  pages: PageData[]
  cssContents: Record<string, string[]>
}

export interface Threshold {
  /** Minimum share (0-1) of all checks that must pass */
  total: number
}

export interface BrandResult {
  name: string
  domain: string
  status: 'evaluated' | 'missing_snapshot'
  colorHit?: boolean
  fontHit?: boolean
  logoHit?: boolean
  gotColors?: string[]
  gotFonts?: string[]
  logoUrl?: string
}

export interface EvalResult {
  brands: BrandResult[]
  evaluated: number
  colorHits: number
  fontHits: number
  logoHits: number
  /** Passed checks / all checks over evaluated brands (0-1); null when nothing was evaluated */
  total: number | null
  threshold: number
  passed: boolean
}

const COLOR_DELTA_E = 10
const TOP_RANKS = 2
const deltaE = differenceCiede2000()

/**
 * Case/space/quote-insensitive family key
 */
export function fontKey(name: string): string {
  return name.toLowerCase().replace(/['"\s]/g, '')
}

/**
 * Read and revive a gzipped snapshot (Sets were serialised as arrays)
 */
export function loadSnapshot(file: string): Snapshot {
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')) as Snapshot
  for (const page of raw.pages) {
    const extraction = (page as PageData & { typographyExtraction?: { fontWeights?: Record<string, unknown> } }).typographyExtraction
    if (extraction?.fontWeights) {
      for (const [font, weights] of Object.entries(extraction.fontWeights)) {
        extraction.fontWeights[font] = new Set(Array.isArray(weights) ? weights : [])
      }
    }
  }
  return raw
}

/**
 * Run the extractors on one snapshot, with their debug logging silenced
 */
function runExtractors(snapshot: Snapshot) {
  const cssContents = new Map(Object.entries(snapshot.cssContents))
  const log = console.log
  console.log = () => {}
  try {
    return {
      colors: extractColors(snapshot.pages, cssContents).colors,
      fonts: extractTypography(snapshot.pages, cssContents).fonts,
      logo: extractLogo(snapshot.pages),
    }
  } finally {
    console.log = log
  }
}

/**
 * Score one brand against its snapshot
 */
export function scoreBrand(brand: ExpectedBrand, snapshot: Snapshot): BrandResult {
  const { colors, fonts, logo } = runExtractors(snapshot)
  const topColors = colors.slice(0, TOP_RANKS).map(c => c.hex)
  const topFonts = fonts.slice(0, TOP_RANKS).map(f => f.name)
  const accepted = new Set(brand.primaryFonts.values.map(fontKey))

  return {
    name: brand.name,
    domain: brand.domain,
    status: 'evaluated',
    colorHit: topColors.some(hex => brand.primaryColors.values.some(v => deltaE(hex, v) < COLOR_DELTA_E)),
    fontHit: topFonts.some(name => accepted.has(fontKey(name))),
    logoHit: Boolean(logo.logoUrl),
    gotColors: topColors,
    gotFonts: topFonts,
    logoUrl: logo.logoUrl,
  }
}

/**
 * Run the whole eval
 */
export function runEval(opts: { expected: ExpectedFile; snapshotsDir: string; threshold: Threshold }): EvalResult {
  const brands: BrandResult[] = []
  for (const brand of opts.expected.brands) {
    const file = path.join(opts.snapshotsDir, `${brand.domain}.json.gz`)
    if (!fs.existsSync(file)) {
      brands.push({ name: brand.name, domain: brand.domain, status: 'missing_snapshot' })
      continue
    }
    brands.push(scoreBrand(brand, loadSnapshot(file)))
  }

  const evaluated = brands.filter(b => b.status === 'evaluated')
  const colorHits = evaluated.filter(b => b.colorHit).length
  const fontHits = evaluated.filter(b => b.fontHit).length
  const logoHits = evaluated.filter(b => b.logoHit).length
  const total = evaluated.length > 0 ? (colorHits + fontHits + logoHits) / (evaluated.length * 3) : null

  return {
    brands,
    evaluated: evaluated.length,
    colorHits,
    fontHits,
    logoHits,
    total,
    threshold: opts.threshold.total,
    passed: total !== null && total >= opts.threshold.total,
  }
}

/**
 * CLI entry point: returns the process exit code
 * (0 pass, 1 below threshold, 2 nothing evaluated).
 */
export function cliMain(argv: string[], baseDir: string, print: (s: string) => void = console.log): number {
  const arg = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : fallback
  }
  const expected = JSON.parse(fs.readFileSync(arg('expected', path.join(baseDir, 'expected.json')), 'utf8')) as ExpectedFile
  const threshold = JSON.parse(fs.readFileSync(arg('threshold', path.join(baseDir, 'threshold.json')), 'utf8')) as Threshold
  const result = runEval({ expected, snapshotsDir: arg('snapshots', path.join(baseDir, 'snapshots')), threshold })

  print(formatResult(result))
  if (result.total === null) return 2
  return result.passed ? 0 : 1
}

const mark = (hit: boolean | undefined) => (hit ? 'yes' : 'NO ')

/**
 * Render the per-brand table and totals as plain text
 */
export function formatResult(result: EvalResult): string {
  const rows = [['Brand', 'Colour', 'Font', 'Logo', 'Top colours', 'Top fonts']]
  for (const b of result.brands) {
    if (b.status === 'missing_snapshot') {
      rows.push([b.name, '-', '-', '-', 'no snapshot', ''])
      continue
    }
    rows.push([b.name, mark(b.colorHit), mark(b.fontHit), mark(b.logoHit), (b.gotColors ?? []).join(' '), (b.gotFonts ?? []).join(', ')])
  }
  const widths = rows[0].map((_, i) => Math.max(...rows.map(r => r[i].length)))
  const lines = rows.map(r => r.map((cell, i) => cell.padEnd(widths[i])).join(' | ').trimEnd())
  lines.splice(1, 0, widths.map(w => '-'.repeat(w)).join('-|-'))

  const pct = (n: number) => (result.evaluated ? `${Math.round((n / result.evaluated) * 100)}%` : 'n/a')
  lines.push('')
  lines.push(`Evaluated ${result.evaluated} of ${result.brands.length} brands`)
  lines.push(`Primary colour: ${result.colorHits}/${result.evaluated} (${pct(result.colorHits)})`)
  lines.push(`Primary font:   ${result.fontHits}/${result.evaluated} (${pct(result.fontHits)})`)
  lines.push(`Logo found:     ${result.logoHits}/${result.evaluated} (${pct(result.logoHits)})`)
  lines.push(
    result.total === null
      ? 'Total: n/a (no snapshots; run the capture script first)'
      : `Total: ${(result.total * 100).toFixed(1)}% (threshold ${(result.threshold * 100).toFixed(1)}%) ${result.passed ? 'PASS' : 'FAIL'}`
  )
  return lines.join('\n')
}
