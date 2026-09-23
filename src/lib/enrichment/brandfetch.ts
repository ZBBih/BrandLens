/**
 * Brandfetch API integration.
 *
 * Brandfetch data is only 'verified' (confidence 100) when the brand owner has
 * claimed the profile; otherwise it is 'third_party' (confidence 70), and
 * strong rendered-area evidence from the crawl can outrank its primary colour.
 */

import { ColorEntry, DataSource, FontEntry, SocialLink } from '../extractors/types'
import { colorDifference } from '../extractors/colors'

interface BrandfetchLogo {
  type: string
  theme: string
  formats: {
    src: string
    background: string | null
    format: string
    size: number
  }[]
}

interface BrandfetchColor {
  hex: string
  type: string
  brightness: number
}

interface BrandfetchFont {
  name: string
  type: string
  origin: string | null
  originId: string | null
  weights: number[]
}

interface BrandfetchLink {
  name: string
  url: string
}

export interface BrandfetchResponse {
  name: string
  domain: string
  claimed: boolean
  description: string
  longDescription: string | null
  links: BrandfetchLink[]
  logos: BrandfetchLogo[]
  colors: BrandfetchColor[]
  fonts: BrandfetchFont[]
  images: {
    src: string
    type: string
  }[]
  qualityScore: number
}

export interface BrandfetchData {
  name: string
  description: string
  logoUrl: string | null
  colors: ColorEntry[]
  fonts: FontEntry[]
  socialLinks: SocialLink[]
  verified: boolean
}

const REQUEST_TIMEOUT_MS = 8000
const HEX_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

/** Brandfetch colour type -> our role (1:1) */
const COLOR_TYPE_ROLE: Record<string, ColorEntry['role']> = {
  brand: 'primary',
  accent: 'accent',
  dark: 'text',
  light: 'background',
}

/**
 * An extracted primary whose rendered-area share is at least this large can
 * outrank an unclaimed Brandfetch primary that is barely visible on the site.
 */
const STRONG_AREA_SHARE = 0.05
/** Colours further apart than this (CIEDE2000) disagree */
const DISAGREE_DELTA_E = 10
const SAME_COLOR_DELTA_E = 3

/**
 * Check if Brandfetch API is configured
 */
export function isBrandfetchConfigured(): boolean {
  return !!process.env.BRANDFETCH_API_KEY
}

/**
 * Validate and normalise a Brandfetch hex value to lowercase '#rrggbb'.
 * Expands 3-digit values; returns null for anything invalid.
 */
export function normalizeBrandfetchHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const m = HEX_PATTERN.exec(raw.trim())
  if (!m) return null
  let h = m[1].toLowerCase()
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  return `#${h}`
}

/**
 * Only https URLs are allowed for images shown to viewers
 */
function httpsOnly(raw: string | undefined | null): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Fetch brand data from Brandfetch API
 */
export async function fetchBrandfetchData(domain: string): Promise<BrandfetchData | null> {
  const apiKey = process.env.BRANDFETCH_API_KEY

  if (!apiKey) {
    return null
  }

  try {
    // Clean domain (remove protocol, www, path)
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]

    const response = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(cleanDomain)}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`Brand not found in Brandfetch: ${cleanDomain}`)
        return null
      }
      throw new Error(`Brandfetch API error: ${response.status}`)
    }

    const data: BrandfetchResponse = await response.json()

    return transformBrandfetchData(data)
  } catch (error) {
    console.error('Brandfetch API error:', error)
    return null
  }
}

/**
 * Transform Brandfetch response to our data format
 */
export function transformBrandfetchData(data: BrandfetchResponse): BrandfetchData {
  const claimed = data.claimed === true
  const source: DataSource = claimed ? 'verified' : 'third_party'
  const confidence = claimed ? 100 : 70
  const label = claimed ? 'Verified' : 'Brandfetch (unclaimed)'
  const evidenceUrl = `https://brandfetch.com/${encodeURIComponent(data.domain ?? '')}`

  // Get primary logo URL (https only)
  let logoUrl: string | null = null
  const logos = Array.isArray(data.logos) ? data.logos : []
  const primaryLogo = logos.find(l => l.type === 'logo') || logos[0]
  if (primaryLogo?.formats?.length > 0) {
    // Prefer SVG, then PNG
    const svgFormat = primaryLogo.formats.find(f => f.format === 'svg')
    const pngFormat = primaryLogo.formats.find(f => f.format === 'png')
    logoUrl = httpsOnly(svgFormat?.src) ?? httpsOnly(pngFormat?.src) ?? httpsOnly(primaryLogo.formats[0].src)
  }

  // Transform colors: types map 1:1, at most one primary
  const colors: ColorEntry[] = []
  let hasPrimary = false
  for (const color of Array.isArray(data.colors) ? data.colors : []) {
    const hex = normalizeBrandfetchHex(color?.hex)
    if (!hex) continue
    if (colors.some(c => c.hex === hex)) continue

    let role: ColorEntry['role'] = COLOR_TYPE_ROLE[color.type] ?? 'other'
    if (role === 'primary') {
      if (hasPrimary) role = 'secondary'
      hasPrimary = true
    }

    colors.push({
      hex,
      rgb: {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
      },
      role,
      confidence,
      source,
      evidence: [{
        url: evidenceUrl,
        snippet: `${label} colour (${color.type || 'unknown'}): ${hex}`,
        context: 'Brandfetch API',
      }],
    })
  }

  // Transform fonts
  const fonts: FontEntry[] = (Array.isArray(data.fonts) ? data.fonts : [])
    .filter(font => typeof font?.name === 'string' && font.name.trim())
    .map((font, index) => {
      let role: FontEntry['role'] = 'secondary'
      if (font.type === 'title' || font.type === 'heading') {
        role = 'heading'
      } else if (font.type === 'body' || index === 0) {
        role = 'primary'
      }

      return {
        name: font.name.trim(),
        role,
        variants: (font.weights ?? []).filter(w => Number.isInteger(w)).map(w => `${w}`),
        confidence,
        source,
        evidence: [{
          url: evidenceUrl,
          snippet: `${label} font: ${font.name}`,
          context: 'Brandfetch API',
        }],
      }
    })

  // Transform social links
  const socialLinks: SocialLink[] = []
  const platformMap: Record<string, SocialLink['platform']> = {
    twitter: 'twitter',
    instagram: 'instagram',
    linkedin: 'linkedin',
    youtube: 'youtube',
    tiktok: 'tiktok',
    facebook: 'facebook',
  }

  for (const link of Array.isArray(data.links) ? data.links : []) {
    const platform = platformMap[String(link?.name).toLowerCase()]
    const url = httpsOnly(link?.url)
    if (platform && url) {
      socialLinks.push({
        platform,
        url,
        confidence,
        source,
        evidence: [{
          url: evidenceUrl,
          snippet: `${label} ${platform} link`,
          context: 'Brandfetch API',
        }],
      })
    }
  }

  return {
    name: data.name,
    description: data.description || data.longDescription || '',
    logoUrl,
    colors,
    fonts,
    socialLinks,
    verified: claimed,
  }
}

function isColorEntry(item: unknown): item is ColorEntry {
  return !!item && typeof item === 'object' && 'hex' in item && 'rgb' in item && 'role' in item
}

/**
 * Merge Brandfetch colours with extracted colours.
 *
 * - A Brandfetch colour that matches an extracted one (CIEDE2000 < 3)
 *   replaces it, keeping the extracted evidence and area share.
 * - A claimed (verified) Brandfetch primary always wins.
 * - An unclaimed primary loses when rendered-area evidence strongly
 *   disagrees: the extracted primary covers at least 5% of the rendered
 *   area, is visibly different (CIEDE2000 >= 10), and the Brandfetch colour
 *   covers less than a third of that area.
 * - The result has at most one primary.
 */
export function mergeBrandfetchColors(extracted: ColorEntry[], brandfetch: ColorEntry[]): ColorEntry[] {
  const merged: ColorEntry[] = extracted.map(c => ({ ...c, evidence: [...c.evidence] }))
  const areaOf = (hex: string) =>
    extracted.find(c => colorDifference(c.hex, hex) < SAME_COLOR_DELTA_E)?.areaShare ?? 0

  const extractedPrimary = extracted.find(c => c.role === 'primary')
  const bfPrimary = brandfetch.find(c => c.role === 'primary')
  let extractedWins = false
  if (extractedPrimary && bfPrimary && bfPrimary.source !== 'verified') {
    const extShare = extractedPrimary.areaShare ?? 0
    extractedWins =
      extShare >= STRONG_AREA_SHARE &&
      colorDifference(extractedPrimary.hex, bfPrimary.hex) >= DISAGREE_DELTA_E &&
      areaOf(bfPrimary.hex) < extShare / 3
  }

  for (const bf of brandfetch) {
    const entry: ColorEntry = { ...bf, evidence: [...bf.evidence] }
    if (bf === bfPrimary && extractedWins) {
      entry.role = merged.some(c => c.role === 'secondary') ? 'accent' : 'secondary'
    }
    const matchIndex = merged.findIndex(c => colorDifference(c.hex, bf.hex) < SAME_COLOR_DELTA_E)
    if (matchIndex >= 0) {
      const match = merged[matchIndex]
      entry.evidence = [...entry.evidence, ...match.evidence].slice(0, 5)
      if (match.areaShare !== undefined) entry.areaShare = match.areaShare
      if (!entry.cssVariable && match.cssVariable) entry.cssVariable = match.cssVariable
      // Keep the extracted role when it is more specific than Brandfetch's 'other',
      // and keep the extracted primary's role when it won on rendered area
      if (entry.role === 'other' || (extractedWins && match.hex === extractedPrimary?.hex)) {
        entry.role = match.role
      }
      merged.splice(matchIndex, 1)
    }
    merged.push(entry)
  }

  // At most one primary: the winner keeps it, everyone else is demoted
  const winner = extractedWins
    ? merged.find(c => c.role === 'primary' && !!extractedPrimary && colorDifference(c.hex, extractedPrimary.hex) < SAME_COLOR_DELTA_E)
    : merged.find(c => c.role === 'primary' && brandfetch.some(b => b.hex === c.hex)) ??
      merged.find(c => c.role === 'primary')
  for (const c of merged) {
    if (c.role === 'primary' && c !== winner) {
      c.role = merged.some(o => o.role === 'secondary') ? 'accent' : 'secondary'
    }
  }

  const sourceRank = (c: ColorEntry) => (c.source === 'verified' ? 0 : 1)
  return merged
    .map((c, i) => ({ c, i }))
    .sort((a, b) =>
      (Number(b.c.role === 'primary') - Number(a.c.role === 'primary')) ||
      (sourceRank(a.c) - sourceRank(b.c)) ||
      (b.c.confidence - a.c.confidence) ||
      (a.i - b.i)
    )
    .map(({ c }) => c)
}

/**
 * Merge Brandfetch data with extracted data.
 * Verified (claimed) data takes priority; unclaimed third-party data only
 * replaces an extracted item with the same key and is ranked by confidence.
 * Colour lists are merged with mergeBrandfetchColors so rendered-area
 * evidence is respected and at most one primary remains.
 */
export function mergeBrandfetchData<T extends { source: string; confidence: number }>(
  extracted: T[],
  brandfetch: T[],
  keyFn: (item: T) => string
): T[] {
  if (brandfetch.length > 0 && brandfetch.every(isColorEntry) && extracted.every(isColorEntry)) {
    return mergeBrandfetchColors(
      extracted as unknown as ColorEntry[],
      brandfetch as unknown as ColorEntry[]
    ) as unknown as T[]
  }

  const result = new Map<string, T>()

  // Add extracted data first
  for (const item of extracted) {
    const key = keyFn(item)
    result.set(key, item)
  }

  // Override with Brandfetch data
  for (const item of brandfetch) {
    const key = keyFn(item)
    result.set(key, item)
  }

  // Sort by confidence (verified first)
  return Array.from(result.values()).sort((a, b) => {
    if (a.source === 'verified' && b.source !== 'verified') return -1
    if (b.source === 'verified' && a.source !== 'verified') return 1
    return b.confidence - a.confidence
  })
}
