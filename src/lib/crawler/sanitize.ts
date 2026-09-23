/**
 * Validation for data returned by page.evaluate (audit A25).
 *
 * page.evaluate runs in the page's main world, so the site's own JS can
 * redefine getComputedStyle, document.fonts and friends and hand back
 * anything. Every value that crosses back into Node is shape-checked and
 * clamped here before the pipeline sees it.
 */

export const LIMITS = {
  shortString: 200,
  longString: 2_000,
  arrayItems: 200,
  recordKeys: 200,
  stylesheetCount: 200,
  stylesheetBytes: 1024 * 1024,
  stylesheetTotalBytes: 4 * 1024 * 1024,
  htmlBytes: 5 * 1024 * 1024,
  colorKeys: 500,
} as const

type Json = unknown

export function isRecord(v: Json): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function str(v: Json, max: number = LIMITS.shortString): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

export function num(v: Json, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function bool(v: Json): boolean {
  return v === true
}

export function strArray(v: Json, maxItems: number = LIMITS.arrayItems, maxLen: number = LIMITS.shortString): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v.slice(0, maxItems)) {
    if (typeof item === 'string') out.push(item.slice(0, maxLen))
  }
  return out
}

export function strRecord(v: Json, maxKeys: number = LIMITS.recordKeys, maxLen: number = LIMITS.longString): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isRecord(v)) return out
  for (const [k, val] of Object.entries(v).slice(0, maxKeys)) {
    if (typeof val === 'string') out[k.slice(0, LIMITS.shortString)] = val.slice(0, maxLen)
  }
  return out
}

export function numRecord(v: Json, maxKeys: number = LIMITS.recordKeys): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isRecord(v)) return out
  for (const [k, val] of Object.entries(v).slice(0, maxKeys)) {
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) out[k.slice(0, LIMITS.shortString)] = val
  }
  return out
}

/**
 * Stylesheet texts: at most 200 sheets, 1 MB each, 4 MB in total.
 */
export function sanitizeStylesheets(v: Json): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  let total = 0
  for (const item of v.slice(0, LIMITS.stylesheetCount)) {
    if (typeof item !== 'string') continue
    const sheet = item.slice(0, LIMITS.stylesheetBytes)
    if (total + sheet.length > LIMITS.stylesheetTotalBytes) break
    total += sheet.length
    out.push(sheet)
  }
  return out
}

/**
 * colorAreas: keys must be lowercase #rrggbb, values finite and >= 0.
 * The largest 500 entries are kept.
 */
export function sanitizeColorAreas(v: Json): Record<string, number> {
  if (!isRecord(v)) return {}
  const entries: [string, number][] = []
  for (const [k, val] of Object.entries(v)) {
    if (!/^#[0-9a-f]{6}$/.test(k)) continue
    if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) continue
    entries.push([k, Math.round(val)])
    if (entries.length > 10_000) break
  }
  entries.sort((a, b) => b[1] - a[1])
  return Object.fromEntries(entries.slice(0, LIMITS.colorKeys))
}
