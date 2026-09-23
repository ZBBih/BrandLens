/**
 * URL utilities: normalization, validation, and SSRF protection (audit A2, A49, A50, G12)
 *
 * validateUrl is a synchronous string/IP-literal check used for fast input
 * validation. It cannot see what a hostname resolves to; validatePublicUrl
 * adds the DNS check, and safeFetch (src/lib/net/safe-fetch.ts) enforces the
 * address policy again on every connection, which is the real guard.
 */

import dns from 'node:dns'
import { isPublicAddress, parseIp } from '../net/ip'

/** Hostnames that always point at the local machine. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
])

/** Suffixes reserved for local or private networks. */
const BLOCKED_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.intranet',
  '.corp',
  '.lan',
  '.home.arpa',
  '.localdomain',
]

export interface UrlValidationResult {
  valid: boolean
  url?: string
  error?: string
}

/**
 * Normalize a URL: strip trailing slashes, enforce https, clean up
 */
export function normalizeUrl(input: string): string {
  let url = input.trim()

  // Add protocol if missing
  if (!url.match(/^https?:\/\//i)) {
    url = `https://${url}`
  }

  try {
    const parsed = new URL(url)

    // Enforce HTTPS
    parsed.protocol = 'https:'

    // Normalize hostname to lowercase
    parsed.hostname = parsed.hostname.toLowerCase()

    // Remove default port
    if (parsed.port === '443' || parsed.port === '80') {
      parsed.port = ''
    }

    // Remove trailing slash from pathname (except for root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1)
    }

    // Remove hash
    parsed.hash = ''

    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Extract the base domain from a URL (scheme + host)
 */
export function getBaseDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return url
  }
}

/**
 * Extract the site's domain name without protocol, path or a leading "www."
 * (G12: one cache key per site, so example.com and www.example.com match).
 */
export function getDomainName(url: string): string {
  try {
    const parsed = new URL(url)
    return stripWww(parsed.hostname.toLowerCase())
  } catch {
    return url
  }
}

function stripWww(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname
}

/** Explicit port, with each scheme's default port treated as "no port". */
function effectivePort(u: URL): string {
  if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) return ''
  return u.port
}

/**
 * Same site: equal host after lowercasing and stripping a leading "www.",
 * regardless of scheme, AND the same explicit port (A50). So https://a.com
 * and http://www.a.com match, while http://a.com:6379 does not.
 */
export function isSameSite(url1: string, url2: string): boolean {
  try {
    const a = new URL(url1)
    const b = new URL(url2)
    return stripWww(a.hostname.toLowerCase()) === stripWww(b.hostname.toLowerCase()) &&
      effectivePort(a) === effectivePort(b)
  } catch {
    return false
  }
}

/**
 * @deprecated Kept for existing callers. This is a same-SITE check; see isSameSite.
 */
export const isSameOrigin = isSameSite

/**
 * Check a hostname (as canonicalised by URL parsing) against the
 * IP-literal and local/private name rules. Returns an error or null.
 */
function hostnameError(hostname: string): string | null {
  if (!hostname) return 'Invalid URL: missing hostname'

  // WHATWG URL parsing already turned 0x7f.1, 2130706433, 127.1 etc. into
  // dotted quads, so one literal check covers every IPv4 spelling.
  if (parseIp(hostname)) {
    return isPublicAddress(hostname) ? null : 'Private IP addresses are not allowed'
  }
  if (hostname.startsWith('[')) {
    return 'Invalid IP address'
  }

  // "localhost." and "localhost" are the same name.
  const bare = hostname.toLowerCase().replace(/\.+$/, '')
  if (!bare) return 'Invalid URL: missing hostname'

  if (BLOCKED_HOSTNAMES.has(bare) || BLOCKED_SUFFIXES.some(sfx => bare.endsWith(sfx))) {
    return 'Internal hostnames are not allowed'
  }

  // Single-label names (no dot) only resolve on internal networks.
  if (!bare.includes('.')) {
    return 'Internal hostnames are not allowed'
  }

  return null
}

/**
 * Validate a URL for crawling: format, scheme, port, and IP-literal/hostname
 * checks. Synchronous; it does not resolve DNS (see validatePublicUrl).
 */
export function validateUrl(input: string): UrlValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { valid: false, error: 'URL is required' }
  }

  // Add protocol if missing for validation (but keep explicit schemes such
  // as file: or ftp: so they are rejected below).
  let urlToValidate = trimmed
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(urlToValidate) && !/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(urlToValidate)) {
    urlToValidate = `https://${urlToValidate}`
  }

  let parsed: URL
  try {
    parsed = new URL(urlToValidate)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Only allow HTTP/HTTPS
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are allowed' }
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'URLs with credentials are not allowed' }
  }

  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    return { valid: false, error: 'Only ports 80 and 443 are allowed' }
  }

  const hostError = hostnameError(parsed.hostname)
  if (hostError) {
    return { valid: false, error: hostError }
  }

  return { valid: true, url: normalizeUrl(parsed.toString()) }
}

/**
 * validateUrl plus a DNS check: every address the host resolves to must be
 * public. The resolver is injectable for tests.
 */
export async function validatePublicUrl(
  input: string,
  lookup: (hostname: string) => Promise<{ address: string }[]> = (h) => dns.promises.lookup(h, { all: true })
): Promise<UrlValidationResult> {
  const result = validateUrl(input)
  if (!result.valid || !result.url) return result

  const hostname = new URL(result.url).hostname
  if (parseIp(hostname)) return result

  let addresses: { address: string }[]
  try {
    addresses = await lookup(hostname)
  } catch {
    return { valid: false, error: 'Could not resolve hostname' }
  }
  if (addresses.length === 0) {
    return { valid: false, error: 'Could not resolve hostname' }
  }
  if (addresses.some(a => !isPublicAddress(a.address))) {
    return { valid: false, error: 'Hostname resolves to a private address' }
  }
  return result
}

/**
 * Priority pages to crawl first
 */
export const PRIORITY_PATHS = [
  '/',
  '/about',
  '/about-us',
  '/brand',
  '/brand-guidelines',
  '/press',
  '/media',
  '/media-kit',
  '/careers',
  '/jobs',
  '/contact',
  '/blog',
  '/locations',
  '/location',
  '/stores',
  '/store-locator',
  '/find-us',
  '/our-locations',
  '/branches',
  '/offices',
]

/**
 * Check if a URL path is a priority page
 */
export function isPriorityPath(pathname: string): boolean {
  const normalized = pathname.toLowerCase().replace(/\/$/, '') || '/'
  return PRIORITY_PATHS.some(p => normalized === p || normalized.startsWith(p + '/'))
}

/**
 * Sort URLs by priority (priority pages first)
 */
export function sortByPriority(urls: string[]): string[] {
  return [...urls].sort((a, b) => {
    try {
      const pathA = new URL(a).pathname
      const pathB = new URL(b).pathname
      const priorityA = isPriorityPath(pathA) ? 0 : 1
      const priorityB = isPriorityPath(pathB) ? 0 : 1
      return priorityA - priorityB
    } catch {
      return 0
    }
  })
}
