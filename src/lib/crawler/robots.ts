/**
 * Robots.txt parser and caching
 */

const USER_AGENT = 'BrandLens/1.0 (+https://brandlens.app)'

interface RobotRule {
  path: string
  allow: boolean
}

interface RobotsData {
  rules: RobotRule[]
  sitemaps: string[]
  crawlDelay?: number
}

// Cache parsed robots.txt by domain
const robotsCache = new Map<string, { data: RobotsData | null; expires: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * Fetch and parse robots.txt for a domain
 */
export async function fetchRobotsTxt(baseUrl: string): Promise<RobotsData | null> {
  try {
    const url = new URL('/robots.txt', baseUrl)
    const cacheKey = url.origin

    // Check cache
    const cached = robotsCache.get(cacheKey)
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': USER_AGENT,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      // No robots.txt or error - allow all
      const data = { rules: [], sitemaps: [], crawlDelay: undefined }
      robotsCache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL })
      return data
    }

    const text = await response.text()
    const data = parseRobotsTxt(text)
    robotsCache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL })

    return data
  } catch {
    // Error fetching - allow all by default
    return { rules: [], sitemaps: [], crawlDelay: undefined }
  }
}

/**
 * Parse robots.txt content
 */
function parseRobotsTxt(content: string): RobotsData {
  const lines = content.split('\n')
  const rules: RobotRule[] = []
  const sitemaps: string[] = []
  let crawlDelay: number | undefined
  let inUserAgentBlock = false
  let isRelevantBlock = false

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Skip comments and empty lines
    if (!line || line.startsWith('#')) {
      continue
    }

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const directive = line.slice(0, colonIndex).trim().toLowerCase()
    const value = line.slice(colonIndex + 1).trim()

    // Handle User-agent directive
    if (directive === 'user-agent') {
      inUserAgentBlock = true
      // Match our bot or wildcard
      const agent = value.toLowerCase()
      isRelevantBlock = agent === '*' || agent === 'brandlens' || agent.includes('bot')
      continue
    }

    // Handle sitemap (global directive)
    if (directive === 'sitemap') {
      try {
        new URL(value) // Validate URL
        sitemaps.push(value)
      } catch {
        // Invalid URL, skip
      }
      continue
    }

    // Only process rules for relevant user-agent blocks
    if (!inUserAgentBlock || !isRelevantBlock) {
      continue
    }

    // Handle Disallow directive
    if (directive === 'disallow' && value) {
      rules.push({ path: value, allow: false })
    }

    // Handle Allow directive
    if (directive === 'allow' && value) {
      rules.push({ path: value, allow: true })
    }

    // Handle Crawl-delay directive
    if (directive === 'crawl-delay') {
      const delay = parseFloat(value)
      if (!isNaN(delay) && delay >= 0) {
        crawlDelay = delay
      }
    }
  }

  return { rules, sitemaps, crawlDelay }
}

/**
 * Check if a URL path is allowed by robots.txt rules
 */
export function isAllowed(path: string, rules: RobotRule[]): boolean {
  // No rules means everything is allowed
  if (rules.length === 0) {
    return true
  }

  // Normalize path
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  // Find matching rules (most specific match wins)
  let matchedRule: RobotRule | null = null
  let matchLength = 0

  for (const rule of rules) {
    const rulePath = rule.path

    // Check if rule matches
    let matches = false

    if (rulePath.endsWith('*')) {
      // Wildcard at end
      const prefix = rulePath.slice(0, -1)
      matches = normalizedPath.startsWith(prefix)
    } else if (rulePath.includes('*')) {
      // Wildcard in middle - convert to regex
      const pattern = rulePath
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}`)
      matches = regex.test(normalizedPath)
    } else {
      // Exact prefix match
      matches = normalizedPath.startsWith(rulePath)
    }

    // Use most specific (longest) matching rule
    if (matches && rulePath.length > matchLength) {
      matchedRule = rule
      matchLength = rulePath.length
    }
  }

  // If no rule matched, allow by default
  if (!matchedRule) {
    return true
  }

  return matchedRule.allow
}

/**
 * Check if crawling a URL is allowed by robots.txt
 */
export async function canCrawl(url: string): Promise<{ allowed: boolean; crawlDelay?: number }> {
  try {
    const parsed = new URL(url)
    const robotsData = await fetchRobotsTxt(parsed.origin)

    if (!robotsData) {
      return { allowed: true }
    }

    const allowed = isAllowed(parsed.pathname, robotsData.rules)

    return {
      allowed,
      crawlDelay: robotsData.crawlDelay,
    }
  } catch {
    // Error parsing URL - don't allow
    return { allowed: false }
  }
}

/**
 * Get sitemaps from robots.txt
 */
export async function getSitemaps(baseUrl: string): Promise<string[]> {
  const robotsData = await fetchRobotsTxt(baseUrl)
  return robotsData?.sitemaps || []
}

export { USER_AGENT }
