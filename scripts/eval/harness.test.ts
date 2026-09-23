/**
 * End-to-end test of the accuracy eval harness on a committed synthetic
 * snapshot (scripts/eval/fixtures), so the harness is tested before real
 * snapshots are captured.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { describe, it, expect } from 'vitest'
import { cliMain, fontKey, formatResult, loadSnapshot, runEval } from './harness'
import type { ExpectedFile } from './harness'

const fixtures = path.join(__dirname, 'fixtures')
const expected = JSON.parse(fs.readFileSync(path.join(fixtures, 'expected.json'), 'utf8')) as ExpectedFile
const snapshotsDir = path.join(fixtures, 'snapshots')

describe('accuracy eval harness', () => {
  it('scores the synthetic snapshot and skips brands without one', () => {
    const result = runEval({ expected, snapshotsDir, threshold: { total: 0.9 } })
    const acme = result.brands.find(b => b.domain === 'acme.test')!
    expect(acme).toMatchObject({ status: 'evaluated', colorHit: true, fontHit: true, logoHit: true })
    expect(acme.gotColors?.[0]).toBe('#635bff')
    expect(acme.logoUrl).toBe('https://acme.test/img/acme-logo.svg')
    expect(result.brands.find(b => b.domain === 'missing.test')?.status).toBe('missing_snapshot')
    expect(result.evaluated).toBe(1)
    expect(result.total).toBe(1)
    expect(result.passed).toBe(true)

    const table = formatResult(result)
    expect(table).toContain('Acme (synthetic)')
    expect(table).toContain('no snapshot')
    expect(table).toContain('PASS')
  })

  it('fails when the total is below the threshold or nothing was evaluated', () => {
    const strict = runEval({
      expected: { brands: [{ ...expected.brands[0], primaryColors: { values: ['#00ff00'], source: 'x' } }] },
      snapshotsDir,
      threshold: { total: 0.9 },
    })
    expect(strict.colorHits).toBe(0)
    expect(strict.passed).toBe(false)

    const none = runEval({ expected: { brands: [expected.brands[1]] }, snapshotsDir, threshold: { total: 0.5 } })
    expect(none.total).toBeNull()
    expect(none.passed).toBe(false)
  })

  it('matches font families case- and space-insensitively', () => {
    expect(fontKey('Twilio Sans Display')).toBe(fontKey('twiliosansdisplay'))
    expect(fontKey('"Inter"')).toBe('inter')
  })

  it('loads a gzipped snapshot', () => {
    const snap = loadSnapshot(path.join(snapshotsDir, 'acme.test.json.gz'))
    expect(snap.pages).toHaveLength(2)
    expect(snap.finalUrl).toBe('https://acme.test/')
  })

  it('CLI exits 0 at or above the threshold, 1 below it, 2 with no snapshots', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brandlens-eval-'))
    try {
      const run = (total: number, snapshots = snapshotsDir) => {
        const file = path.join(tmp, `threshold-${total}.json`)
        fs.writeFileSync(file, JSON.stringify({ total }))
        const output: string[] = []
        const code = cliMain(
          ['--expected', path.join(fixtures, 'expected.json'), '--snapshots', snapshots, '--threshold', file],
          __dirname,
          s => output.push(s)
        )
        return { code, output: output.join('\n') }
      }
      const ok = run(0.6)
      expect(ok.code).toBe(0)
      expect(ok.output).toContain('Total: 100.0% (threshold 60.0%) PASS')
      expect(run(1.5).code).toBe(1)
      expect(run(0.6, tmp).code).toBe(2)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('ships a threshold and a ground-truth file with sources for every fact', () => {
    const threshold = JSON.parse(fs.readFileSync(path.join(__dirname, 'threshold.json'), 'utf8'))
    expect(threshold.total).toBeGreaterThan(0)
    const real = JSON.parse(fs.readFileSync(path.join(__dirname, 'expected.json'), 'utf8')) as ExpectedFile
    expect(real.brands.length).toBeGreaterThanOrEqual(10)
    for (const brand of real.brands) {
      expect(brand.domain).toMatch(/^[a-z0-9.-]+\.[a-z]+$/)
      for (const fact of [brand.primaryColors, brand.primaryFonts]) {
        expect(fact.values.length).toBeGreaterThan(0)
        expect(fact.source).toMatch(/^https:\/\//)
      }
      for (const hex of brand.primaryColors.values) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})
