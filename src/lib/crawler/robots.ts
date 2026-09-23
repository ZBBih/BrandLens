/**
 * Robots.txt parser and caching (RFC 9309; audit A9, A10, A24)
 *
 * - Group-aware: consecutive User-agent lines form one group. BrandLens obeys
 *   the group(s) naming the `brandlens` product token, else the `*` group(s).
 *   Other bots' groups are never merged in.
 * - Longest match wins; Allow wins ties; `*` and `$` are supported.
 * - Crawl-delay is clamped to at most 10 seconds.
 * - Sitemap URLs are kept only when http(s) and on the same site.
 * - robots.txt is fetched through safeFetch with a 512 KB cap.
 */

import { safeFetch, USER_AGENT } from '../net/safe-fetch'
import { isSameSite } from '../utils/url'

const PRODUCT_TOKEN = 'brandlens'
const MAX_CRAWL_DELAY_S = 10
const MAX_ROBOTS_BYTES = 512 * 1024
const MAX_RULES = 2000
const MAX_SITEMAPS = 20

export interface RobotRule {
  path: string
  allow: boolean
}

export interface RobotsData {
  rules: RobotRule[]
  sitemaps: string[]
  crawlDelay?: number
}

interface Group {
  agents: string[]
  rules: RobotRule[]
  crawlDelay?: number
}

// Cache parsed robots.txt by origin
const robotsCache = new Map<string, { data: RobotsData; expires: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

const EMPTY: RobotsData = { rules: [], sitemaps: [], crawlDelay: undefined }

/**
 * Fetch and parse robots.txt for a site. Unavailable or unreadable
 * robots.txt means "allow all" (unchanged behaviour).
 */
export async function fetchRobotsTxt(baseUrl: string, signal?: AbortSignal): Promise<RobotsData> {
  let url: URL
  try {
    url = new URL('/robots.txt', baseUrl)
  } catch {
    return EMPTY
  }
  const cacheKey = url.origin

  const cached = robotsCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  let data: RobotsData = EMPTY
  try {
    const response = await safeFetch(url.toString(), {
      maxBytes: MAX_ROBOTS_BYTES,
      timeoutMs: 10_000,
      signal,
    })
    if (response.status >= 200 && response.status < 300) {
      data = parseRobotsTxt(response.text(), url.toString())
    }
  } catch {
    // Caller aborts must propagate; everything else means "allow all".
    signal?.throwIfAborted()
    return EMPTY
  }

  robotsCache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL })
  return data
}

/**
 * Parse robots.txt content for BrandLens. `robotsUrl` is used to resolve
 * and same-site-check Sitemap entries.
 */
export function parseRobotsTxt(content: string, robotsUrl: string): RobotsData {
  const groups: Group[] = []
  const sitemaps: string[] = []
  let current: Group | null = null
  // True while we are still reading the User-agent lines at the head of a group.
  let inAgentLines = false

  for (const rawLine of content.split(/\r\n|\r|\n/)) {
    const hash = rawLine.indexOf('#')
    const line = (hash === -1 ? rawLine : rawLine.slice(0, hash)).trim()
    if (!line) continue

    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const directive = line.slice(0, colonIndex).trim().toLowerCase()
    const value = line.slice(colonIndex + 1).trim()

    switch (directive) {
      case 'user-agent': {
        if (!current || !inAgentLines) {
          current = { agents: [], rules: [] }
          groups.push(current)
          inAgentLines = true
        }
        current.agents.push(value.toLowerCase())
        break
      }
      case 'allow':
      case 'disallow': {
        inAgentLines = false
        // An empty Disallow means "nothing disallowed": no rule.
        if (!current || !value) break
        if (current.rules.length < MAX_RULES) {
          current.rules.push({ path: value, allow: directive === 'allow' })
        }
        break
      }
      case 'crawl-delay': {
        inAgentLines = false
        if (!current) break
        const delay = parseFloat(value)
        if (Number.isFinite(delay) && delay >= 0) {
          current.crawlDelay = Math.min(delay, MAX_CRAWL_DELAY_S)
        }
        break
      }
      case 'sitemap': {
        // Global directive; does not end the agent-line run.
        const sitemap = acceptSitemap(value, robotsUrl)
        if (sitemap && sitemaps.length < MAX_SITEMAPS && !sitemaps.includes(sitemap)) {
          sitemaps.push(sitemap)
        }
        break
      }
      default:
        // Unknown directives end the User-agent run like any other rule line.
        inAgentLines = false
    }
  }

  const selected = selectGroups(groups)
  const rules = selected.flatMap(g => g.rules)
  const delays = selected.map(g => g.crawlDelay).filter((d): d is number => d !== undefined)
  const crawlDelay = delays.length > 0 ? Math.max(...delays) : undefined

  return { rules, sitemaps, crawlDelay }
}

/**
 * Pick the groups that apply to BrandLens: those naming our product token,
 * else those for `*`. Multiple matching groups are combined (RFC 9309 2.2.1).
 */
function selectGroups(groups: Group[]): Group[] {
  const ours = groups.filter(g => g.agents.some(agentMatches))
  if (ours.length > 0) return ours
  return groups.filter(g => g.agents.includes('*'))
}

function agentMatches(agent: string): boolean {
  // "BrandLens", "brandlens/1.0" and "BrandLens (+url)" all name our token.
  const token = agent.split(/[\s/(]/)[0]
  return token === PRODUCT_TOKEN
}

function acceptSitemap(value: string, robotsUrl: string): string | null {
  try {
    const url = new URL(value, robotsUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!isSameSite(url.toString(), robotsUrl)) return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Match a robots path pattern (`*` wildcard, `$` end anchor) against a path.
 * Linear-time greedy wildcard matching; no regex, so no ReDoS.
 */
export function matchesPattern(pattern: string, path: string): boolean {
  let pat = pattern
  let anchored = false
  if (pat.endsWith('$')) {
    anchored = true
    pat = pat.slice(0, -1)
  }

  // Without an anchor the pattern is a prefix match, i.e. an implicit trailing '*'.
  if (!anchored) pat += '*'

  let p = 0
  let s = 0
  let starP = -1
  let starS = 0
  while (s < path.length) {
    if (p < pat.length && pat[p] !== '*' && pat[p] === path[s]) {
      p++
      s++
    } else if (p < pat.length && pat[p] === '*') {
      starP = p++
      starS = s
    } else if (starP !== -1) {
      p = starP + 1
      s = ++starS
    } else {
      return false
    }
  }
  while (p < pat.length && pat[p] === '*') p++
  return p === pat.length
}

/**
 * Check if a URL path (optionally with query) is allowed by robots rules.
 * Longest matching pattern wins; Allow wins a tie.
 */
export function isAllowed(path: string, rules: RobotRule[]): boolean {
  if (rules.length === 0) return true

  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  let best: RobotRule | null = null
  for (const rule of rules) {
    if (!matchesPattern(rule.path, normalizedPath)) continue
    if (
      !best ||
      rule.path.length > best.path.length ||
      (rule.path.length === best.path.length && rule.allow && !best.allow)
    ) {
      best = rule
    }
  }

  // /robots.txt itself is always allowed; no match means allowed.
  return best ? best.allow : true
}

/**
 * Check if crawling a URL is allowed by robots.txt
 */
export async function canCrawl(
  url: string,
  signal?: AbortSignal
): Promise<{ allowed: boolean; crawlDelay?: number }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { allowed: false }
  }
  const robotsData = await fetchRobotsTxt(parsed.origin, signal)
  return {
    allowed: isAllowed(parsed.pathname + parsed.search, robotsData.rules),
    crawlDelay: robotsData.crawlDelay,
  }
}

/**
 * Get same-site sitemaps from robots.txt
 */
export async function getSitemaps(baseUrl: string, signal?: AbortSignal): Promise<string[]> {
  const robotsData = await fetchRobotsTxt(baseUrl, signal)
  return robotsData.sitemaps
}

/** Test hook: forget cached robots.txt data. */
export function clearRobotsCache(): void {
  robotsCache.clear()
}

export { USER_AGENT }
