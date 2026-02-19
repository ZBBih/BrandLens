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
  'widgets',
  'embed',
  'oauth',
  'api',
]

// Technical usernames to filter out (JS libraries, SDKs, etc.)
const TECHNICAL_USERNAMES = [
  'mapbox',
  'gl-js',
  'sdk',
  'api',
  'cdn',
  'webpack',
  'node',
  'npm',
  'yarn',
  'react',
  'angular',
  'vue',
  'jquery',
  'bootstrap',
  'tailwind',
  'font',
  'icon',
  'share',
  'widget',
  'embed',
  'plugin',
  'module',
  'package',
  'lib',
  'dist',
  'build',
  'src',
  'assets',
  'static',
  'public',
  'js',
  'css',
  'img',
]

/**
 * Check if a username looks like a technical/library reference
 */
function isTechnicalUsername(handle: string | undefined): boolean {
  if (!handle) return false

  const cleaned = handle.replace('@', '').toLowerCase()

  // Check exact matches first
  if (TECHNICAL_USERNAMES.includes(cleaned)) return true

  // Check if username contains technical terms
  for (const term of TECHNICAL_USERNAMES) {
    if (cleaned.includes(term) && cleaned.length < 25) {
      // Short usernames with technical terms are likely false positives
      return true
    }
  }

  // Check for patterns that look like library versions or package names
  if (/^[a-z]+-[a-z]+-[a-z]+$/i.test(cleaned)) return true // like "mapbox-gl-js"
  if (/^\d+\.\d+/.test(cleaned)) return true // version numbers
  if (/^[@/]/.test(cleaned)) return true // scoped packages

  return false
}

/**
 * Check if URL is actually in an <a href> tag (not a JS reference)
 */
function isValidSocialLink(url: string, html: string): boolean {
  // The URL must be in an href attribute
  const hrefPattern = new RegExp(`href=["']${escapeRegex(url)}["']`, 'i')
  const hasHref = hrefPattern.test(html)

  if (!hasHref) {
    // Check for partial match (URL might have been modified)
    const domain = getDomainFromUrl(url)
    if (!domain) return false

    const partialHrefPattern = new RegExp(`<a[^>]+href=["'][^"']*${escapeRegex(domain)}[^"']*["']`, 'i')
    return partialHrefPattern.test(html)
  }

  return true
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function getDomainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

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
 * Normalize social URL for deduplication
 */
function normalizeUrl(url: string): string {
  // Ensure https
  if (!url.startsWith('http')) {
    url = `https://${url}`
  }

  url = url.replace(/^http:/, 'https:')

  // Remove trailing slashes
  url = url.replace(/\/+$/, '')

  // Remove query params and hash for comparison
  try {
    const parsed = new URL(url)
    // Keep only the pathname
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/**
 * Create a unique key for deduplication based on platform and handle
 */
function getDedupeKey(platform: string, handle: string | undefined, url: string): string {
  // If we have a handle, use platform + normalized handle
  if (handle) {
    const normalizedHandle = handle.replace(/^@/, '').toLowerCase()
    return `${platform}:${normalizedHandle}`
  }
  // Otherwise use the normalized URL
  return normalizeUrl(url)
}

/**
 * Validate that a social URL matches expected platform patterns
 */
function isValidPlatformUrl(url: string, platform: PlatformConfig): boolean {
  const normalizedUrl = url.toLowerCase()

  switch (platform.name) {
    case 'twitter':
      // Must be twitter.com/username or x.com/username (not /intent/, /share/, etc.)
      return /(?:twitter|x)\.com\/[a-zA-Z0-9_]{1,15}\/?$/.test(normalizedUrl) ||
             /(?:twitter|x)\.com\/[a-zA-Z0-9_]{1,15}\?/.test(normalizedUrl)
    case 'instagram':
      // Must be instagram.com/username
      return /instagram\.com\/[a-zA-Z0-9_.]{1,30}\/?$/.test(normalizedUrl) ||
             /instagram\.com\/[a-zA-Z0-9_.]{1,30}\?/.test(normalizedUrl)
    case 'facebook':
      // Must be facebook.com/pagename (not /sharer/, /dialog/, etc.)
      return /(?:facebook|fb)\.com\/[a-zA-Z0-9.]{1,50}\/?$/.test(normalizedUrl) ||
             /(?:facebook|fb)\.com\/[a-zA-Z0-9.]{1,50}\?/.test(normalizedUrl)
    case 'linkedin':
      // Must be linkedin.com/company/name or linkedin.com/in/name
      return /linkedin\.com\/(?:company|in)\/[a-zA-Z0-9-]{1,100}\/?/.test(normalizedUrl)
    case 'youtube':
      // Must be youtube.com/channel/, youtube.com/@, youtube.com/c/, youtube.com/user/
      return /youtube\.com\/(?:channel\/|@|c\/|user\/)[a-zA-Z0-9_-]+/.test(normalizedUrl)
    case 'tiktok':
      // Must be tiktok.com/@username
      return /tiktok\.com\/@[a-zA-Z0-9_.]{1,24}/.test(normalizedUrl)
    default:
      return true
  }
}

/**
 * Extract social links from a page
 */
function extractFromPage(page: PageData): SocialLink[] {
  const links: SocialLink[] = []
  const seen = new Set<string>()

  // Extract from anchor tags - ONLY match actual <a href="..."> tags
  // This regex ensures we're inside an anchor tag
  const anchorPattern = /<a[^>]+href=["']([^"']*(?:instagram\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|tiktok\.com|facebook\.com|fb\.com)\/[^"']+)["'][^>]*>/gi

  let match
  while ((match = anchorPattern.exec(page.html)) !== null) {
    const url = match[1]
    if (shouldIgnore(url)) continue

    const platform = identifyPlatform(url)
    if (!platform) continue

    // Validate URL matches expected platform pattern
    if (!isValidPlatformUrl(url, platform)) continue

    const normalizedUrl = normalizeUrl(url)
    if (seen.has(normalizedUrl)) continue

    const handle = platform.handleExtractor?.(url)

    // Filter out technical usernames (JS libraries, SDKs, etc.)
    if (isTechnicalUsername(handle)) continue

    seen.add(normalizedUrl)

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

      // Filter out technical usernames
      if (isTechnicalUsername(handle)) continue

      const url = `https://twitter.com/${handle.replace('@', '')}`
      const normalizedUrl = normalizeUrl(url)

      if (!seen.has(normalizedUrl)) {
        seen.add(normalizedUrl)
        links.push({
          platform: 'twitter',
          url: normalizedUrl,
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
  const seenByUrl = new Map<string, SocialLink>()
  const seenByKey = new Map<string, SocialLink>()

  for (const page of pages) {
    const pageLinks = extractFromPage(page)

    for (const link of pageLinks) {
      const normalizedUrl = normalizeUrl(link.url)
      const dedupeKey = getDedupeKey(link.platform, link.handle, link.url)

      // Check both URL and dedupe key to catch duplicates
      const existingByUrl = seenByUrl.get(normalizedUrl)
      const existingByKey = seenByKey.get(dedupeKey)
      const existing = existingByUrl || existingByKey

      if (!existing) {
        seenByUrl.set(normalizedUrl, link)
        seenByKey.set(dedupeKey, link)
        allLinks.push(link)
      } else {
        // Merge evidence
        existing.evidence.push(...link.evidence)
        // Take higher confidence
        if (link.confidence > existing.confidence) {
          existing.confidence = link.confidence
        }
        // Prefer URL with handle if we didn't have one
        if (!existing.handle && link.handle) {
          existing.handle = link.handle
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
