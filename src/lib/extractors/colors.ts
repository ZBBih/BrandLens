/**
 * Color extractor - extracts the brand color palette from CSS and, when
 * available, from rendered-area measurements.
 *
 * Signals, strongest first:
 * 1. Rendered area (`page.colorAreas`, lowercase '#rrggbb' -> px², filled by
 *    the Playwright crawler for the first two viewport heights). The color
 *    that covers the most chromatic pixels is the primary.
 * 2. Brand context and CSS custom-property names (header/nav/button/hero
 *    selectors, `--brand-primary`, ...).
 * 3. Weighted CSS usage frequency (text and background fills count more than
 *    borders, outlines, carets or shadows).
 *
 * Color values are parsed with culori, so every CSS syntax is understood:
 * hex 3/4/6/8, rgb()/rgba() in comma and space syntax with `/ alpha`,
 * hsl()/hwb(), lab()/lch()/oklab()/oklch(), color() and named colors.
 * Near-identical colors (CIEDE2000 < 3) are merged.
 */

import { parse, formatHex, differenceCiede2000, converter, toGamut } from 'culori'
import type { Color, Lab65 } from 'culori'
import type { PageData } from '../crawler'
import type { ColorEntry, ColorData, Evidence } from './types'

/** Page data plus the optional rendered-area map produced by the crawler */
type PageWithAreas = PageData & { colorAreas?: Record<string, number> }

type Rgb = { r: number; g: number; b: number }

/** How a color is used by a CSS property */
export type ColorUsageKind =
  | 'text'
  | 'background'
  | 'border'
  | 'outline'
  | 'caret'
  | 'accent-control'
  | 'fill'
  | 'stroke'
  | 'decoration'
  | 'shadow'
  | 'definition'

/** Relative weight of each usage kind in the frequency signal */
const USAGE_WEIGHT: Record<ColorUsageKind, number> = {
  text: 1,
  background: 1,
  fill: 0.8,
  stroke: 0.6,
  'accent-control': 0.6,
  border: 0.4,
  outline: 0.3,
  decoration: 0.3,
  shadow: 0.2,
  caret: 0.2,
  definition: 0.25,
}

// Role keywords in CSS variable names
const ROLE_KEYWORDS: [string, ColorEntry['role']][] = [
  ['primary', 'primary'],
  ['brand', 'primary'],
  ['secondary', 'secondary'],
  ['accent', 'accent'],
  ['highlight', 'accent'],
  ['cta', 'primary'],
  ['background', 'background'],
  ['surface', 'background'],
  ['foreground', 'text'],
]

/**
 * Brand context patterns (high brand value)
 */
const BRAND_CONTEXT_PATTERNS = [
  /header/i, /nav/i,
  /btn/i, /button/i, /cta/i,
  /(^|[\s>+~,])a(?=$|[\s:.[#,>])/i, /link/i, /anchor/i,
  /logo/i, /brand/i,
  /hero/i, /banner/i,
  /primary/i, /accent/i,
]

const MAX_EVIDENCE = 5
const MERGE_DELTA_E = 3
const MAX_COLORS = 10
const MAX_CHROMATIC = 7
const MAX_NEUTRALS_PER_ROLE = 2
/** Area shares below this are treated as noise when ranking */
const AREA_NOISE_FLOOR = 0.002

/** Only the strongest signals are clustered; the long tail can't reach the palette */
const MAX_SIGNALS_TO_GROUP = 400

const toRgbGamut = toGamut('rgb', 'oklch')
const toOklch = converter('oklch')
const toLab = converter('lab65')
const deltaE2000 = differenceCiede2000()

/**
 * Parse one CSS color value into lowercase '#rrggbb'.
 * Returns null for unparseable values, keywords like currentcolor, and
 * colors with alpha < 0.5.
 */
export function parseCssColor(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (!v || v.length > 200) return null
  let color: Color | undefined
  try {
    color = parse(v)
  } catch {
    return null
  }
  if (!color) return null
  if (color.alpha !== undefined && color.alpha < 0.5) return null
  return formatHex(toRgbGamut(color)).toLowerCase()
}

/**
 * Lowercase '#rrggbb' to channel values
 */
export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/**
 * CIEDE2000 difference between two hex colors
 */
export function colorDifference(a: string, b: string): number {
  return deltaE2000(a, b)
}

/**
 * Near-neutral: whites, greys (including slate/zinc tints) and blacks.
 * These go to the background/text roles and never compete for primary.
 */
export function isNeutralColor(hex: string): boolean {
  const c = toOklch(hex)
  if (!c) return true
  return (c.c ?? 0) < 0.05 || c.l > 0.97 || c.l < 0.12
}

/**
 * Split a CSS value into top-level tokens (whitespace, comma or slash
 * separated), keeping parenthesised groups intact.
 */
export function tokenizeCssValue(value: string): string[] {
  const tokens: string[] = []
  let depth = 0
  let current = ''
  for (const ch of value) {
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && (ch === ' ' || ch === '\t' || ch === '\n' || ch === ',' || ch === '/')) {
      if (current) tokens.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current) tokens.push(current)
  return tokens
}

const COLOR_FUNCTION = /^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i
const VAR_REF = /var\(\s*(--[\w-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/

/**
 * Remove var() placeholders in the alpha slot of a color function:
 * `rgb(37 99 235 / var(--tw-bg-opacity))` counts as opaque.
 */
function stripAlphaPlaceholders(value: string): string {
  return value
    .replace(/\s*\/\s*var\(\s*--[\w-]+\s*(?:,[^()]*)?\)\s*\)/g, ')')
    .replace(/(rgba|hsla)\(([^()]*?),\s*var\(\s*--[\w-]+\s*(?:,[^()]*)?\)\s*\)/gi, '$1($2)')
}

/** Resolves var() references; memoized per custom property */
export type VarResolver = (value: string) => string

const UNRESOLVED = '__unresolved__'

/**
 * Build a resolver for var(--x[, fallback]) references against the
 * collected custom properties. Unresolvable references become a marker that
 * extractColorsFromValue ignores. Memoised and depth-limited, so hostile
 * chains of custom properties stay linear.
 */
export function createVarResolver(vars: Map<string, string>): VarResolver {
  const cache = new Map<string, string>()
  const resolving = new Set<string>()

  const resolveValue = (value: string, depth: number): string => {
    if (depth > 5 || !value.includes('var(')) return value
    let out = value
    for (let i = 0; i < 12 && out.includes('var('); i++) {
      const m = VAR_REF.exec(out)
      if (!m) break
      let replacement: string
      if (vars.has(m[1]) && !resolving.has(m[1])) {
        replacement = resolveName(m[1], depth + 1)
      } else if (m[2] !== undefined) {
        replacement = resolveValue(stripAlphaPlaceholders(m[2].trim()), depth + 1)
      } else {
        replacement = UNRESOLVED
      }
      out = (out.slice(0, m.index) + replacement + out.slice(m.index + m[0].length)).slice(0, 500)
    }
    return out
  }

  const resolveName = (name: string, depth: number): string => {
    const cached = cache.get(name)
    if (cached !== undefined) return cached
    resolving.add(name)
    const resolved = resolveValue(stripAlphaPlaceholders(vars.get(name) ?? ''), depth)
    resolving.delete(name)
    cache.set(name, resolved)
    return resolved
  }

  return (value: string) => resolveValue(value, 0)
}

/**
 * Extract every color appearing in a declaration value, including inside
 * shorthands (`background: #2563eb url(x.png) no-repeat`) and gradients.
 */
export function extractColorsFromValue(value: string, resolve?: VarResolver): string[] {
  let v = stripAlphaPlaceholders(value.replace(/!important/gi, ''))
  if (resolve) v = resolve(v)
  const out: string[] = []
  const visit = (text: string, depth: number) => {
    for (const token of tokenizeCssValue(text)) {
      if (token.includes(UNRESOLVED)) continue
      if (COLOR_FUNCTION.test(token) || token.startsWith('#') || /^[a-z]+$/i.test(token)) {
        const hex = parseCssColor(token)
        if (hex) {
          out.push(hex)
          continue
        }
      }
      // Descend into non-color functions such as linear-gradient(...)
      const fn = /^([\w-]+)\(([\s\S]*)\)$/.exec(token)
      if (fn && depth < 3 && fn[1].toLowerCase() !== 'url') {
        visit(fn[2], depth + 1)
      }
    }
  }
  visit(v, 0)
  return out
}

/**
 * Classify a CSS property by how it uses color. Only `color` is text color.
 */
export function classifyColorProperty(property: string): ColorUsageKind | null {
  const p = property.trim().toLowerCase()
  if (p.startsWith('--')) return 'definition'
  if (p === 'color') return 'text'
  if (p === 'background' || p === 'background-color' || p === 'background-image') return 'background'
  if (p === 'border' || p === 'border-color' || /^border-(top|right|bottom|left|block|inline)(-(start|end))?(-color)?$/.test(p)) return 'border'
  if (p === 'outline' || p === 'outline-color') return 'outline'
  if (p === 'caret-color') return 'caret'
  if (p === 'accent-color') return 'accent-control'
  if (p === 'fill') return 'fill'
  if (p === 'stroke') return 'stroke'
  if (p === 'text-decoration' || p === 'text-decoration-color' || p === 'column-rule-color' || p === 'column-rule') return 'decoration'
  if (p === 'box-shadow' || p === 'text-shadow') return 'shadow'
  return null
}

export interface CssDeclaration {
  selector: string
  property: string
  value: string
}

/**
 * Walk every declaration in a stylesheet, tracking the innermost selector.
 * Handles nested at-rules, comments, strings and parentheses (so `;` inside
 * url(data:...) does not split a declaration). Linear in the input size.
 */
export function walkCssDeclarations(css: string, visit: (decl: CssDeclaration) => void): void {
  const stack: string[] = []
  let buf = ''
  let depth = 0
  let quote: string | null = null
  const flush = () => {
    const text = buf.trim()
    buf = ''
    if (!text || stack.length === 0) return
    const colon = text.indexOf(':')
    if (colon <= 0) return
    const property = text.slice(0, colon).trim().toLowerCase()
    if (!/^(--)?[a-z-][\w-]*$/.test(property)) return
    const selector = [...stack].reverse().find(s => !s.startsWith('@')) ?? stack[stack.length - 1]
    visit({ selector, property, value: text.slice(colon + 1).trim() })
  }
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (quote) {
      buf += ch
      if (ch === '\\') { buf += css[++i] ?? ''; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2)
      i = end === -1 ? css.length : end + 1
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue }
    if (ch === '(') depth++
    if (ch === ')') depth = Math.max(0, depth - 1)
    if (depth > 0) { buf += ch; continue }
    if (ch === '{') {
      stack.push(buf.trim().replace(/\s+/g, ' ').slice(0, 200))
      buf = ''
    } else if (ch === '}') {
      flush()
      stack.pop()
    } else if (ch === ';') {
      flush()
    } else {
      buf += ch
    }
  }
  flush()
}

/**
 * Inline `style="..."` declarations from an HTML document
 */
export function extractInlineStyleDeclarations(html: string): CssDeclaration[] {
  const decls: CssDeclaration[] = []
  const re = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi
  let m
  while ((m = re.exec(html)) !== null) {
    const body = (m[1] ?? m[2] ?? '').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    for (const part of body.split(';')) {
      const colon = part.indexOf(':')
      if (colon <= 0) continue
      decls.push({ selector: '[style]', property: part.slice(0, colon).trim().toLowerCase(), value: part.slice(colon + 1).trim() })
    }
  }
  return decls
}

/**
 * Collect custom properties (--name: value) from all stylesheets
 */
export function collectCssVariables(stylesheets: string[]): Map<string, string> {
  const vars = new Map<string, string>()
  for (const css of stylesheets) {
    walkCssDeclarations(css, ({ property, value }) => {
      if (property.startsWith('--') && value.length < 200) vars.set(property, value.replace(/!important/gi, '').trim())
    })
  }
  return vars
}

function roleFromName(name: string): ColorEntry['role'] | null {
  const lower = name.toLowerCase()
  for (const [keyword, role] of ROLE_KEYWORDS) {
    if (lower.includes(keyword)) return role
  }
  return null
}

/** Aggregated signal for one exact hex value */
interface ColorSignal {
  hex: string
  weight: number
  brandWeight: number
  bgWeight: number
  textWeight: number
  area: number
  roleHints: Map<ColorEntry['role'], number>
  cssVariable?: string
  cssEvidence: Evidence[]
  areaEvidence: Evidence[]
}

function newSignal(hex: string): ColorSignal {
  return { hex, weight: 0, brandWeight: 0, bgWeight: 0, textWeight: 0, area: 0, roleHints: new Map(), cssEvidence: [], areaEvidence: [] }
}

function pushEvidence(list: Evidence[], ev: Evidence) {
  if (list.length >= MAX_EVIDENCE * 2) return
  if (list.some(e => e.snippet === ev.snippet && e.url === ev.url)) return
  list.push(ev)
}

/**
 * Record one declaration's colors into the signal map
 */
function recordDeclaration(
  signals: Map<string, ColorSignal>,
  decl: CssDeclaration,
  url: string,
  resolve: VarResolver
) {
  const kind = classifyColorProperty(decl.property)
  if (!kind) return
  const hexes = extractColorsFromValue(decl.value, resolve)
  if (hexes.length === 0) return

  const varName = kind === 'definition' ? decl.property : VAR_REF.exec(decl.value)?.[1]
  const hint = varName ? roleFromName(varName) : null
  const isBrandContext = BRAND_CONTEXT_PATTERNS.some(p => p.test(decl.selector))
  let weight = USAGE_WEIGHT[kind]
  if (kind === 'definition' && hint) weight = 1

  for (const hex of new Set(hexes)) {
    let s = signals.get(hex)
    if (!s) {
      s = newSignal(hex)
      signals.set(hex, s)
    }
    s.weight += weight
    if (isBrandContext) s.brandWeight += weight
    if (kind === 'background') s.bgWeight += weight
    if (kind === 'text') s.textWeight += weight
    if (hint) s.roleHints.set(hint, (s.roleHints.get(hint) ?? 0) + 1)
    if (kind === 'definition' && !s.cssVariable) s.cssVariable = decl.property
    pushEvidence(s.cssEvidence, {
      url,
      snippet: `${decl.property}: ${decl.value}`.slice(0, 160),
      context: decl.selector || undefined,
    })
  }
}

/** A cluster of near-identical colors */
interface ColorGroup {
  rep: ColorSignal
  members: ColorSignal[]
  weight: number
  brandWeight: number
  bgWeight: number
  textWeight: number
  area: number
  roleHints: Map<ColorEntry['role'], number>
  neutral: boolean
}

/**
 * Merge near-identical colors (CIEDE2000 < 3). The representative is the
 * member with the most rendered area, then the highest usage weight.
 */
function groupSignals(signals: ColorSignal[]): ColorGroup[] {
  const sorted = [...signals]
    .sort((a, b) => (b.area - a.area) || (b.weight - a.weight) || a.hex.localeCompare(b.hex))
    .slice(0, MAX_SIGNALS_TO_GROUP)
  const groups: (ColorGroup & { lab: Lab65 })[] = []
  for (const s of sorted) {
    const lab: Lab65 = toLab(s.hex) ?? { mode: 'lab65', l: 0, a: 0, b: 0 }
    // CIEDE2000 >= |dL| / 1.75, so a lightness gap of 6+ can never merge
    const group = groups.find(g => Math.abs(g.lab.l - lab.l) < 6 && deltaE2000(g.lab, lab) < MERGE_DELTA_E)
    if (group) {
      group.members.push(s)
      group.weight += s.weight
      group.brandWeight += s.brandWeight
      group.bgWeight += s.bgWeight
      group.textWeight += s.textWeight
      group.area += s.area
      for (const [role, n] of s.roleHints) group.roleHints.set(role, (group.roleHints.get(role) ?? 0) + n)
    } else {
      groups.push({
        lab,
        rep: s,
        members: [s],
        weight: s.weight,
        brandWeight: s.brandWeight,
        bgWeight: s.bgWeight,
        textWeight: s.textWeight,
        area: s.area,
        roleHints: new Map(s.roleHints),
        neutral: isNeutralColor(s.hex),
      })
    }
  }
  return groups
}

function strongestHint(group: ColorGroup): ColorEntry['role'] | null {
  let best: ColorEntry['role'] | null = null
  let bestN = 0
  for (const [role, n] of group.roleHints) {
    if (n > bestN) {
      best = role
      bestN = n
    }
  }
  return best
}

/**
 * CSS-only brand score: share of usages in brand contexts plus a bonus for
 * brand-ish custom-property names, plus log-scaled usage frequency.
 */
function cssScore(group: ColorGroup): number {
  const brandShare = group.weight > 0 ? group.brandWeight / group.weight : 0
  const hint = strongestHint(group)
  const hintBonus = hint === 'primary' ? 30 : hint === 'accent' || hint === 'secondary' ? 12 : 0
  return brandShare * 40 + hintBonus + 20 * Math.log2(1 + group.weight)
}

/**
 * Confidence derived from actual signal strength (area share and/or usage
 * share), never a constant.
 */
function deriveConfidence(areaShare: number, usageShare: number, hasArea: boolean, hasCss: boolean): number {
  const strength = Math.max(Math.min(1, areaShare / 0.25), Math.min(1, usageShare / 0.3))
  let confidence = 30 + 60 * Math.sqrt(strength)
  if (hasArea && hasCss) confidence += 5
  return Math.round(Math.min(95, confidence))
}

function buildEntry(
  group: ColorGroup,
  role: ColorEntry['role'],
  totalArea: number,
  totalWeight: number
): ColorEntry {
  const areaShare = totalArea > 0 ? group.area / totalArea : 0
  const usageShare = totalWeight > 0 ? group.weight / totalWeight : 0
  const areaEvidence = group.members.flatMap(m => m.areaEvidence)
  const cssEvidence = group.members.flatMap(m => m.cssEvidence)
  const evidence: Evidence[] = []
  for (const ev of [...areaEvidence.slice(0, 2), ...cssEvidence]) {
    if (evidence.length >= MAX_EVIDENCE) break
    pushEvidence(evidence, ev)
  }
  const cssVariable = group.members.find(m => m.cssVariable)?.cssVariable
  const entry: ColorEntry = {
    hex: group.rep.hex,
    rgb: hexToRgb(group.rep.hex),
    role,
    confidence: deriveConfidence(areaShare, usageShare, group.area > 0, group.weight > 0),
    source: 'extracted',
    evidence,
  }
  if (cssVariable) entry.cssVariable = cssVariable
  if (totalArea > 0) entry.areaShare = Math.round(areaShare * 1000) / 1000
  return entry
}

/**
 * Rank groups and assign roles
 */
function rankAndAssign(groups: ColorGroup[], hasAreas: boolean): ColorEntry[] {
  const totalArea = groups.reduce((sum, g) => sum + g.area, 0)
  const totalWeight = groups.reduce((sum, g) => sum + g.weight, 0)
  const areaKey = (g: ColorGroup) => {
    const share = totalArea > 0 ? g.area / totalArea : 0
    return share < AREA_NOISE_FLOOR ? 0 : share
  }

  const chromatic = groups
    .filter(g => !g.neutral)
    .sort((a, b) => {
      if (hasAreas) {
        const diff = areaKey(b) - areaKey(a)
        if (diff !== 0) return diff
      }
      return (cssScore(b) - cssScore(a)) || (b.weight - a.weight) || a.rep.hex.localeCompare(b.rep.hex)
    })
    .slice(0, MAX_CHROMATIC)

  const result: ColorEntry[] = []
  chromatic.forEach((group, index) => {
    const hint = strongestHint(group)
    let role: ColorEntry['role']
    if (index === 0) role = 'primary'
    else if (hint === 'secondary' || hint === 'accent') role = hint
    else if (index === 1) role = 'secondary'
    else if (index <= 4) role = 'accent'
    else role = 'other'
    result.push(buildEntry(group, role, totalArea, totalWeight))
  })

  // Neutrals: light ones are backgrounds, dark ones are text
  const neutrals = groups
    .filter(g => g.neutral)
    .sort((a, b) => (areaKey(b) - areaKey(a)) || (b.weight - a.weight) || a.rep.hex.localeCompare(b.rep.hex))
  const counts = { background: 0, text: 0 }
  for (const group of neutrals) {
    const lightness = toOklch(group.rep.hex)?.l ?? 0
    const role: 'background' | 'text' =
      group.bgWeight > group.textWeight * 2 ? 'background'
        : group.textWeight > group.bgWeight * 2 ? 'text'
          : lightness >= 0.6 ? 'background' : 'text'
    if (counts[role] >= MAX_NEUTRALS_PER_ROLE) continue
    counts[role]++
    result.push(buildEntry(group, role, totalArea, totalWeight))
  }

  return result.slice(0, MAX_COLORS)
}

/**
 * Extract colors from crawled pages
 */
export function extractColors(
  pages: PageData[],
  cssContents: Map<string, string[]>
): ColorData {
  const signals = new Map<string, ColorSignal>()
  const allCss = [...cssContents.values()].flat()
  const resolve = createVarResolver(collectCssVariables(allCss))

  // CSS usage signal. Identical stylesheets shared by several pages are
  // counted once so a site-wide stylesheet doesn't multiply its weight.
  const seen = new Set<string>()
  for (const [pageUrl, cssArray] of cssContents) {
    for (const css of cssArray) {
      if (seen.has(css)) continue
      seen.add(css)
      walkCssDeclarations(css, decl => recordDeclaration(signals, decl, pageUrl, resolve))
    }
  }

  // Inline style="" attributes
  for (const page of pages) {
    for (const decl of extractInlineStyleDeclarations(page.html || '')) {
      recordDeclaration(signals, decl, page.url, resolve)
    }
  }

  // Rendered-area signal
  let hasAreas = false
  for (const page of pages as PageWithAreas[]) {
    if (!page.colorAreas) continue
    const pageTotal = Object.values(page.colorAreas).reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0)
    for (const [rawHex, px] of Object.entries(page.colorAreas)) {
      if (!Number.isFinite(px) || px <= 0) continue
      const hex = parseCssColor(rawHex)
      if (!hex) continue
      hasAreas = true
      let s = signals.get(hex)
      if (!s) {
        s = newSignal(hex)
        signals.set(hex, s)
      }
      s.area += px
      const share = pageTotal > 0 ? (px / pageTotal) * 100 : 0
      pushEvidence(s.areaEvidence, {
        url: page.url,
        snippet: `rendered area: ${share.toFixed(1)}% of the first two viewports`,
        context: 'Rendered page',
      })
    }
  }

  const groups = groupSignals([...signals.values()])
  return { colors: rankAndAssign(groups, hasAreas) }
}
