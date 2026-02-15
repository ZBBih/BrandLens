/**
 * Brandfetch API integration for verified brand data
 */

import { ColorEntry, FontEntry, SocialLink } from '../extractors/types'

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

interface BrandfetchResponse {
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

/**
 * Check if Brandfetch API is configured
 */
export function isBrandfetchConfigured(): boolean {
  return !!process.env.BRANDFETCH_API_KEY
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

    const response = await fetch(`https://api.brandfetch.io/v2/brands/${cleanDomain}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10000),
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
function transformBrandfetchData(data: BrandfetchResponse): BrandfetchData {
  // Get primary logo URL
  let logoUrl: string | null = null
  const primaryLogo = data.logos.find(l => l.type === 'logo') || data.logos[0]
  if (primaryLogo?.formats?.length > 0) {
    // Prefer PNG or SVG
    const pngFormat = primaryLogo.formats.find(f => f.format === 'png')
    const svgFormat = primaryLogo.formats.find(f => f.format === 'svg')
    logoUrl = svgFormat?.src || pngFormat?.src || primaryLogo.formats[0].src
  }

  // Transform colors
  const colors: ColorEntry[] = data.colors.map((color, index) => {
    let role: ColorEntry['role'] = 'other'
    if (color.type === 'accent' || index === 0) {
      role = 'primary'
    } else if (index === 1) {
      role = 'secondary'
    } else if (color.type === 'dark' || color.brightness < 50) {
      role = 'text'
    } else if (color.type === 'light' || color.brightness > 200) {
      role = 'background'
    } else {
      role = 'accent'
    }

    // Parse hex to RGB
    const hex = color.hex.startsWith('#') ? color.hex : `#${color.hex}`
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)

    return {
      hex,
      rgb: { r, g, b },
      role,
      confidence: 100,
      source: 'verified' as const,
      evidence: [{
        url: `https://brandfetch.com/${data.domain}`,
        snippet: `Verified color: ${hex}`,
        context: 'Brandfetch API',
      }],
    }
  })

  // Transform fonts
  const fonts: FontEntry[] = data.fonts.map((font, index) => {
    let role: FontEntry['role'] = 'secondary'
    if (font.type === 'title' || font.type === 'heading') {
      role = 'heading'
    } else if (font.type === 'body' || index === 0) {
      role = 'primary'
    }

    return {
      name: font.name,
      role,
      variants: font.weights?.map(w => `${w}`) || [],
      confidence: 100,
      source: 'verified' as const,
      evidence: [{
        url: `https://brandfetch.com/${data.domain}`,
        snippet: `Verified font: ${font.name}`,
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

  for (const link of data.links) {
    const platform = platformMap[link.name.toLowerCase()]
    if (platform) {
      socialLinks.push({
        platform,
        url: link.url,
        confidence: 100,
        source: 'verified' as const,
        evidence: [{
          url: `https://brandfetch.com/${data.domain}`,
          snippet: `Verified ${platform} link`,
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
    verified: data.claimed,
  }
}

/**
 * Merge Brandfetch data with extracted data
 * Brandfetch data takes priority when available
 */
export function mergeBrandfetchData<T extends { source: string; confidence: number }>(
  extracted: T[],
  brandfetch: T[],
  keyFn: (item: T) => string
): T[] {
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
