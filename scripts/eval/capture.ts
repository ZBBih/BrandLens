/**
 * Capture crawl snapshots for the accuracy eval.
 *
 *   npx tsx scripts/eval/capture.ts [domain ...]
 *
 * Runs the real crawl() for every domain in expected.json (or the domains
 * given on the command line) and writes scripts/eval/snapshots/<domain>.json.gz
 * in the format the harness reads. Snapshots are trimmed to stay under
 * ~400KB gzipped: at most 10 pages, identical stylesheets stored once, and
 * page HTML reduced to <head> plus the start of <body> when needed.
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { crawl } from '../../src/lib/crawler'
import type { PageData } from '../../src/lib/crawler'
import type { ExpectedFile, Snapshot } from './harness'

const MAX_PAGES = 10
const MAX_GZIP_BYTES = 400 * 1024
const BODY_BUDGETS = [Infinity, 150_000, 60_000, 20_000]
const CSS_BUDGETS = [Infinity, 400_000, 200_000, 100_000]

/** JSON replacer: Sets (typographyExtraction.fontWeights) become arrays */
function replacer(_key: string, value: unknown): unknown {
  return value instanceof Set ? [...value] : value
}

/**
 * Keep <head> (meta, links, styles) and the first `budget` characters of <body>
 */
function trimHtml(html: string, budget: number): string {
  if (html.length <= budget) return html
  const bodyStart = html.search(/<body[\s>]/i)
  if (bodyStart < 0) return html.slice(0, budget)
  return html.slice(0, bodyStart) + html.slice(bodyStart, bodyStart + budget) + '</body></html>'
}

function buildSnapshot(finalUrl: string, pages: PageData[], css: Map<string, string[]>, bodyBudget: number, cssBudget: number): Snapshot {
  const seen = new Set<string>()
  const cssContents: Record<string, string[]> = {}
  for (const page of pages) {
    const sheets: string[] = []
    let used = 0
    for (const sheet of css.get(page.url) ?? []) {
      if (seen.has(sheet)) continue
      seen.add(sheet)
      if (used + sheet.length > cssBudget) continue
      used += sheet.length
      sheets.push(sheet)
    }
    cssContents[page.url] = sheets
  }
  return {
    capturedAt: new Date().toISOString(),
    finalUrl,
    pages: pages.map(p => ({ ...p, html: trimHtml(p.html, bodyBudget), inlineCss: [] })),
    cssContents,
  }
}

async function captureDomain(domain: string, outDir: string): Promise<void> {
  const startUrl = `https://${domain}/`
  console.log(`[capture] ${domain}: crawling ${startUrl}`)
  const result = await crawl(startUrl)
  const finalUrl = (result as { finalUrl?: string }).finalUrl ?? startUrl
  const pages = result.pages.slice(0, MAX_PAGES)
  if (pages.length === 0) {
    console.warn(`[capture] ${domain}: no pages crawled (${result.errors.slice(0, 3).join('; ')})`)
    return
  }

  let gz: Buffer | null = null
  for (let i = 0; i < BODY_BUDGETS.length; i++) {
    const snapshot = buildSnapshot(finalUrl, pages, result.cssContents, BODY_BUDGETS[i], CSS_BUDGETS[i])
    gz = zlib.gzipSync(JSON.stringify(snapshot, replacer), { level: 9 })
    if (gz.length <= MAX_GZIP_BYTES) break
  }
  if (!gz) return
  const file = path.join(outDir, `${domain}.json.gz`)
  fs.writeFileSync(file, gz)
  console.log(`[capture] ${domain}: ${pages.length} pages, ${(gz.length / 1024).toFixed(0)}KB -> ${path.relative(process.cwd(), file)}`)
}

async function main(): Promise<void> {
  const here = path.resolve(__dirname)
  const expected = JSON.parse(fs.readFileSync(path.join(here, 'expected.json'), 'utf8')) as ExpectedFile
  const requested = process.argv.slice(2).filter(a => !a.startsWith('--'))
  const domains = requested.length > 0 ? requested : expected.brands.map(b => b.domain)
  const outDir = path.join(here, 'snapshots')
  fs.mkdirSync(outDir, { recursive: true })

  for (const domain of domains) {
    try {
      await captureDomain(domain, outDir)
    } catch (error) {
      console.error(`[capture] ${domain} failed:`, error)
      process.exitCode = 1
    }
  }
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  error => {
    console.error(error)
    process.exit(1)
  }
)
