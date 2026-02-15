/**
 * Social links extractor - extracts social media presence
 */

import { PageData } from '../crawler'
import { SocialLink, SocialData } from './types'

interface PlatformConfig {
  name: SocialLink['platform']
  patterns: RegExp[]
  handleExtractor?: (url: string) => string | undefined
}

const PLATFORM_CONFIGS: PlatformConfig[] = [
  {
    name: 'instagram',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^\/\?\s]+)/i,
      /(?:https?:\/\/)?(?:www\.)?instagr\.am\/([^\/\?\s]+)/i,
    ],
    handleExtractor: (url: string) => {
      const match = url.match(/instagram\.com\/([^\/\?\s]+)/i)
      return match ? `@${match[1]}` : undefined
    },
  },
  {
    name: 'twitter',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([^\/\?\s]+)/i,
    ],
    handleExtractor: (url: string) => {
      const match = url.match(/(?:twitter|x)\.com\/([^\/\?\s]+)/i)
      return match ? `@${match[1]}` : undefined
    },
  },
  {
    name: 'linkedin',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(company|in)\/([^\/\?\s]+)/i,
    ],
    handleExtractor: (url: string) => {
      const match = url.match(/linkedin\.com\/(?:company|in)\/([^\/\?\s]+)/i)
      return match ? match[1] : undefined
    },
  },
  {
    name: 'youtube',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|channel\/|user\/|@)?([^\/\?\s]+)/i,
    ],
    handleExtractor: (url: string) => {
      const match = url.match(/youtube\.com\/(?:c\/|channel\/|user\/|@)?([^\/\?\s]+)/i)
      return match ? match[1] : undefined
    },
  },
  {
    name: 'tiktok',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@?([^\/\?\s]+)/i,
    ],
    handleExtractor: (url: string) => {
      const match = url.match(/tiktok\.com\/@?([^\/\?\s]+)/i)
      return match ? `@${match[1].replace('@', '')}` : undefined
    },
  },
  {
    name: 'facebook',
    patterns: [
      /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([^\/\?\s]+)/i,
      /(?:https?:\/\/)?(?:www\.)?fb\.com\/([^\/\?\s]+)/i,
    ],
    handleExtractor: (url: string) => {
      const match = url.match(/(?:facebook|fb)\.com\/([^\/\?\s]+)/i)
      return match ? match[1] : undefined
    },
  },
]

// URLs to ignore (not actual profiles)
const IGNORED_PATHS = [
  'sharer',
  'share',
  'intent',
  'dialog',
  'login',
  'signup',
  'help',
  'about',
  'privacy',
  'terms',
  'settings',
]

/**
 * Identify platform from URL
 */
function identifyPlatform(url: string): PlatformConfig | null {
  for (const config of PLATFORM_CONFIGS) {
    for (const pattern of config.patterns) {
      if (pattern.test(url)) {
        return config
      }
    }
  }
  return null
}

/**
 * Check if URL should be ignored
 */
function shouldIgnore(url: string): boolean {
  const lower = url.toLowerCase()
  return IGNORED_PATHS.some(path => lower.includes(`/${path}`))
}

/**
 * Normalize social URL
 */
function normalizeUrl(url: string): string {
  // Ensure https
  if (!url.startsWith('http')) {
    url = `https://${url}`
  }

  // Convert twitter.com to x.com for consistency? Actually keep original
  return url.replace(/^http:/, 'https:')
}

/**
 * Extract social links from a page
 */
function extractFromPage(page: PageData): SocialLink[] {
  const links: SocialLink[] = []
  const seen = new Set<string>()

  // Extract from anchor tags
  const hrefPattern = /href=["']([^"']*(?:instagram|twitter|x\.com|linkedin|youtube|tiktok|facebook|fb\.com)[^"']*)["']/gi

  let match
  while ((match = hrefPattern.exec(page.html)) !== null) {
    const url = match[1]
    if (shouldIgnore(url)) continue

    const platform = identifyPlatform(url)
    if (!platform) continue

    const normalizedUrl = normalizeUrl(url)
    if (seen.has(normalizedUrl)) continue
    seen.add(normalizedUrl)

    const handle = platform.handleExtractor?.(url)

    links.push({
      platform: platform.name,
      url: normalizedUrl,
      handle,
      confidence: 85,
      source: 'extracted',
      evidence: [{
        url: page.url,
        snippet: `Social link: ${normalizedUrl}`,
        context: 'HTML link',
      }],
    })
  }

  // Extract from OpenGraph data
  const ogSocial: Record<string, string | undefined> = {
    'twitter:site': page.twitterData['site'],
    'twitter:creator': page.twitterData['creator'],
  }

  for (const [key, value] of Object.entries(ogSocial)) {
    if (value && value.startsWith('@')) {
      const handle = value
      const url = `https://twitter.com/${handle.replace('@', '')}`

      if (!seen.has(url)) {
        seen.add(url)
        links.push({
          platform: 'twitter',
          url,
          handle,
          confidence: 90,
          source: 'extracted',
          evidence: [{
            url: page.url,
            snippet: `${key}: ${handle}`,
            context: 'Twitter meta tag',
          }],
        })
      }
    }
  }

  return links
}

/**
 * Extract social links from all crawled pages
 */
export function extractSocial(pages: PageData[]): SocialData {
  const allLinks: SocialLink[] = []
  const seen = new Map<string, SocialLink>()

  for (const page of pages) {
    const pageLinks = extractFromPage(page)

    for (const link of pageLinks) {
      const existing = seen.get(link.url)
      if (!existing) {
        seen.set(link.url, link)
        allLinks.push(link)
      } else {
        // Merge evidence
        existing.evidence.push(...link.evidence)
        // Take higher confidence
        if (link.confidence > existing.confidence) {
          existing.confidence = link.confidence
        }
      }
    }
  }

  // Sort by platform order (most important first)
  const platformOrder: Record<SocialLink['platform'], number> = {
    linkedin: 0,
    twitter: 1,
    instagram: 2,
    youtube: 3,
    facebook: 4,
    tiktok: 5,
    other: 6,
  }

  allLinks.sort((a, b) => platformOrder[a.platform] - platformOrder[b.platform])

  return {
    links: allLinks,
  }
}
