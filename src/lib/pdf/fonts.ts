/**
 * PDF font setup: Unicode-capable fonts for @react-pdf/renderer (G8).
 *
 * - Noto Sans from @fontsource/noto-sans (.woff, read by fontkit) is
 *   registered as one family per unicode-range subset (latin, latin-ext,
 *   cyrillic, cyrillic-ext, greek, greek-ext, vietnamese). react-pdf 4.x
 *   picks a font per code point from a `fontFamily: [...]` stack
 *   (textkit fontSubstitution), so the subsets act as one fallback chain.
 * - CJK fonts (Noto Sans SC/JP/KR) are fetched from the Fontsource jsDelivr
 *   CDN only when the report contains CJK text; failures are logged and the
 *   report still renders.
 * - Emoji are rendered as Twemoji PNGs prefetched from jsDelivr; emoji that
 *   cannot be fetched are removed.
 * - Any character no registered font can draw is replaced, so the built-in
 *   Helvetica fallback never produces corrupt glyphs.
 */

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Font } from '@react-pdf/renderer'

const SUBSETS = ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext', 'greek', 'greek-ext', 'vietnamese'] as const
const WEIGHTS = [400, 600, 700] as const

export const BASE_FONT_STACK: string[] = SUBSETS.map(subset => `BrandLens Noto Sans ${subset}`)

type CjkVariant = 'jp' | 'kr' | 'sc'

const CJK_FONTS: Record<CjkVariant, { family: string; url: string }> = {
  jp: {
    family: 'BrandLens Noto Sans JP',
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@latest/japanese-400-normal.woff',
  },
  kr: {
    family: 'BrandLens Noto Sans KR',
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.woff',
  },
  sc: {
    family: 'BrandLens Noto Sans SC',
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-sc@latest/chinese-simplified-400-normal.woff',
  },
}

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/'
const CJK_TIMEOUT_MS = 15_000
const EMOJI_TIMEOUT_MS = 5_000
const MAX_CJK_BYTES = 12 * 1024 * 1024
const MAX_EMOJI_BYTES = 256 * 1024
const MAX_EMOJI = 60
const FAILURE_TTL_MS = 5 * 60 * 1000
/** An invalid data URI: react-pdf's image loader rejects it and falls back to the font */
const NO_EMOJI = 'data:image/png;base64,'

export const REPLACEMENT_CHAR = '?'

const HAN = /\p{Script=Han}/u
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u
const HANGUL = /\p{Script=Hangul}/u

const EMOJI_CLUSTER =
  /\p{Regional_Indicator}\p{Regional_Indicator}|[#*0-9]️?⃣|\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️|[\u{E0020}-\u{E007E}]+\u{E007F})*(?:‍\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️)*)*/gu

const DEFAULT_IGNORABLE = /[­͏؜ᅟᅠ឴឵᠋-᠏​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ\u{E0000}-\u{E0FFF}]/u

let baseRegistered = false
const registeredCjk = new Set<CjkVariant>()
const cjkLoads = new Map<CjkVariant, Promise<boolean>>()
const failures = new Map<string, number>()
const emojiCache = new Map<string, string>()

/**
 * Locate @fontsource/noto-sans on disk at runtime (not through the bundler)
 */
function fontsourceDir(): string {
  const candidates: string[] = []
  try {
    const req = createRequire(path.join(process.cwd(), 'package.json'))
    candidates.push(path.dirname(req.resolve('@fontsource/noto-sans/package.json')))
  } catch {
    // fall through to the conventional location
  }
  candidates.push(path.join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans'))
  const found = candidates.find(dir => fs.existsSync(path.join(dir, 'files')))
  if (!found) throw new Error('@fontsource/noto-sans is not installed')
  return found
}

type LoadableSource = { data: unknown; _load: () => Promise<void> }

type SubsetFont = {
  postscriptName?: string
  hasGlyphForCodePoint(codePoint: number): boolean
  glyphForCodePoint(codePoint: number): unknown
}

const HYPHEN_MINUS = 0x2d
const SPACE = 0x20

/**
 * Patch each subset font as it loads:
 * - Every Fontsource subset file carries the same PostScript name
 *   (e.g. "NotoSans-Regular") and pdfkit reuses an embedded font by that
 *   name, which would draw Cyrillic glyph ids with the Latin file. Each
 *   subset gets a unique name so it is embedded separately.
 * - textkit may break a word where it switches fonts (e.g. "Ł|ódź") and
 *   inserts '-' in the font of the broken run. Subsets without '-' draw an
 *   invisible space there instead of a missing-glyph box.
 */
function patchSubsetOnLoad(family: string, suffix: string): void {
  const registered = Font.getRegisteredFonts()[family] as unknown as { sources: LoadableSource[] } | undefined
  for (const source of registered?.sources ?? []) {
    const original = source._load.bind(source)
    source._load = async () => {
      await original()
      const data = source.data as SubsetFont | null
      if (!data || typeof data.postscriptName !== 'string' || data.postscriptName.endsWith(suffix)) return
      Object.defineProperty(data, 'postscriptName', { value: `${data.postscriptName}${suffix}`, configurable: true })
      if (!data.hasGlyphForCodePoint(HYPHEN_MINUS)) {
        const glyphForCodePoint = data.glyphForCodePoint.bind(data)
        data.glyphForCodePoint = (codePoint: number) =>
          glyphForCodePoint(codePoint === HYPHEN_MINUS ? SPACE : codePoint)
      }
    }
  }
}

/**
 * Register the bundled Noto Sans subsets (idempotent)
 */
export function registerBaseFonts(): void {
  if (baseRegistered) return
  const dir = path.join(fontsourceDir(), 'files')
  for (const subset of SUBSETS) {
    const family = `BrandLens Noto Sans ${subset}`
    Font.register({
      family,
      fonts: WEIGHTS.map(weight => ({
        src: path.join(dir, `noto-sans-${subset}-${weight}-normal.woff`),
        fontWeight: weight,
        fontStyle: 'normal' as const,
      })),
    })
    patchSubsetOnLoad(family, `-${subset.replace(/[^a-z]/g, '')}`)
  }
  Font.registerEmojiSource({
    builder: (code: string) => emojiCache.get(code) ?? NO_EMOJI,
    withVariationSelectors: false,
  })
  baseRegistered = true
}

function recentlyFailed(key: string): boolean {
  const at = failures.get(key)
  return at !== undefined && Date.now() - at < FAILURE_TTL_MS
}

async function fetchBytes(url: string, timeoutMs: number, maxBytes: number): Promise<Uint8Array> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  const length = Number(response.headers.get('content-length') ?? 0)
  if (length > maxBytes) throw new Error(`Response too large (${length} bytes) for ${url}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maxBytes || bytes.byteLength === 0) throw new Error(`Unexpected size ${bytes.byteLength} for ${url}`)
  return bytes
}

/**
 * Which CJK fonts a text needs (Japanese before Chinese for kana text)
 */
export function cjkVariantsFor(text: string): CjkVariant[] {
  const variants: CjkVariant[] = []
  if (KANA.test(text)) variants.push('jp')
  if (HANGUL.test(text)) variants.push('kr')
  if (HAN.test(text) && !variants.includes('jp')) variants.push('sc')
  return variants
}

async function loadCjk(variant: CjkVariant): Promise<boolean> {
  if (registeredCjk.has(variant)) return true
  const { family, url } = CJK_FONTS[variant]
  if (recentlyFailed(url)) return false
  let pending = cjkLoads.get(variant)
  if (!pending) {
    pending = (async () => {
      try {
        const bytes = await fetchBytes(url, CJK_TIMEOUT_MS, MAX_CJK_BYTES)
        Font.register({ family, src: `data:font/woff;base64,${Buffer.from(bytes).toString('base64')}`, fontWeight: 400 })
        await Font.load({ fontFamily: family, fontWeight: 400 })
        registeredCjk.add(variant)
        return true
      } catch (error) {
        failures.set(url, Date.now())
        console.warn(`[PDF] CJK font ${variant} unavailable, affected characters will be replaced:`, error instanceof Error ? error.message : error)
        return false
      } finally {
        cjkLoads.delete(variant)
      }
    })()
    cjkLoads.set(variant, pending)
  }
  return pending
}

/** Twemoji file name for an emoji, matching react-pdf's builder input */
function emojiCode(emoji: string): string {
  return Array.from(emoji)
    .filter(c => c !== '️')
    .map(c => (c.codePointAt(0) ?? 0).toString(16))
    .join('-')
}

async function loadEmoji(code: string): Promise<boolean> {
  if (emojiCache.has(code)) return true
  const url = `${TWEMOJI_BASE}${code}.png`
  if (recentlyFailed(url)) return false
  try {
    const bytes = await fetchBytes(url, EMOJI_TIMEOUT_MS, MAX_EMOJI_BYTES)
    emojiCache.set(code, `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`)
    return true
  } catch {
    failures.set(url, Date.now())
    return false
  }
}

type GlyphFont = { hasGlyphForCodePoint(codePoint: number): boolean }

async function loadedFonts(stack: string[]): Promise<GlyphFont[]> {
  const fonts: GlyphFont[] = []
  for (const fontFamily of stack) {
    await Font.load({ fontFamily, fontWeight: 400 })
    const data = Font.getFont({ fontFamily, fontWeight: 400 })?.data as GlyphFont | null | undefined
    if (data) fonts.push(data)
  }
  return fonts
}

export interface PreparedFonts {
  /** fontFamily stack to put on every Page */
  fontStack: string[]
  /** Replace characters no registered font can draw */
  sanitize: (text: string) => string
}

/**
 * Register and load every font a text needs, prefetch its emoji, and return
 * the font stack plus a sanitizer. Never throws for network failures.
 */
export async function prepareFonts(allText: string): Promise<PreparedFonts> {
  registerBaseFonts()

  const fontStack = [...BASE_FONT_STACK]
  const cjk = cjkVariantsFor(allText)
  const loaded = await Promise.all(cjk.map(loadCjk))
  cjk.forEach((variant, i) => {
    if (loaded[i]) fontStack.push(CJK_FONTS[variant].family)
  })

  const fonts = await loadedFonts(fontStack)
  const coverage = new Map<number, boolean>()
  const covered = (cp: number) => {
    let hit = coverage.get(cp)
    if (hit === undefined) {
      hit = fonts.some(f => f.hasGlyphForCodePoint(cp))
      coverage.set(cp, hit)
    }
    return hit
  }
  const coveredText = (text: string) =>
    Array.from(text).every(ch => DEFAULT_IGNORABLE.test(ch) || ch === '⃣' || covered(ch.codePointAt(0) ?? 0))

  // Emoji: keep clusters the fonts can draw; prefetch images for the rest
  const emojiNeeded = new Set<string>()
  for (const match of allText.matchAll(EMOJI_CLUSTER)) {
    if (!coveredText(match[0])) emojiNeeded.add(emojiCode(match[0]))
    if (emojiNeeded.size >= MAX_EMOJI) break
  }
  await Promise.all([...emojiNeeded].map(loadEmoji))

  const sanitizeChars = (text: string) => {
    let out = ''
    for (const ch of text) {
      const cp = ch.codePointAt(0) ?? 0
      if (cp < 0x20 || covered(cp)) out += ch
      else if (DEFAULT_IGNORABLE.test(ch)) continue
      else out += REPLACEMENT_CHAR
    }
    return out
  }

  const sanitize = (text: string): string => {
    let out = ''
    let last = 0
    for (const match of text.matchAll(EMOJI_CLUSTER)) {
      const index = match.index ?? 0
      out += sanitizeChars(text.slice(last, index))
      const emoji = match[0]
      if (coveredText(emoji)) out += emoji
      else if (emojiCache.has(emojiCode(emoji))) out += emoji
      // otherwise drop the emoji entirely
      last = index + emoji.length
    }
    return out + sanitizeChars(text.slice(last))
  }

  return { fontStack, sanitize }
}

/**
 * Test helper: forget remote-asset failures so a later test can retry
 */
export function resetRemoteAssetFailures(): void {
  failures.clear()
}
