/**
 * URL utilities: normalization, validation, and SSRF protection
 */

// Private IP ranges to block (SSRF protection)
const PRIVATE_IP_PATTERNS = [
  /^127\./,                           // 127.0.0.0/8 (localhost)
  /^10\./,                            // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
  /^192\.168\./,                      // 192.168.0.0/16
  /^169\.254\./,                      // 169.254.0.0/16 (link-local)
  /^0\./,                             // 0.0.0.0/8
  /^224\./,                           // 224.0.0.0/4 (multicast)
  /^240\./,                           // 240.0.0.0/4 (reserved)
  /^255\./,                           // broadcast
]

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '::1',
  '::',
  'ip6-localhost',
  'ip6-loopback',
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
 * Extract just the domain name (without protocol or path)
 */
export function getDomainName(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}

/**
 * Check if two URLs are on the same origin
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const parsed1 = new URL(url1)
    const parsed2 = new URL(url2)
    return parsed1.hostname === parsed2.hostname
  } catch {
    return false
  }
}

/**
 * Check if a hostname is a private/internal IP address
 */
function isPrivateIp(hostname: string): boolean {
  // Direct check for blocked hostnames
  if (BLOCKED_HOSTNAMES.includes(hostname.toLowerCase())) {
    return true
  }

  // Check against private IP patterns
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return true
    }
  }

  // Check for IPv6 private/local addresses
  if (hostname.startsWith('[')) {
    const ipv6 = hostname.slice(1, -1).toLowerCase()
    if (ipv6 === '::1' || ipv6.startsWith('fe80:') || ipv6.startsWith('fc') || ipv6.startsWith('fd')) {
      return true
    }
  }

  return false
}

/**
 * Check if a hostname looks like an internal service name
 */
function isInternalHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase()

  // Common internal hostnames
  const internalPatterns = [
    /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.\d+\.\d+\.\d+)$/,
    /\.(local|internal|intranet|corp|lan)$/,
    /^(admin|api|backend|db|database|redis|memcached|elasticsearch|kibana|grafana|prometheus|consul|vault|kubernetes|k8s|docker|container|instance|node|worker|master|slave)/,
    /^169\.254\./,  // AWS metadata service range
    /^metadata\./,   // Cloud metadata services
  ]

  for (const pattern of internalPatterns) {
    if (pattern.test(lower)) {
      return true
    }
  }

  // Check for no TLD (likely internal)
  if (!lower.includes('.') && lower !== 'localhost') {
    return true
  }

  return false
}

/**
 * Validate a URL for crawling - checks format and SSRF protection
 */
export function validateUrl(input: string): UrlValidationResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { valid: false, error: 'URL is required' }
  }

  // Add protocol if missing for validation
  let urlToValidate = trimmed
  if (!urlToValidate.match(/^https?:\/\//i)) {
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

  const hostname = parsed.hostname

  // Check for private IPs
  if (isPrivateIp(hostname)) {
    return { valid: false, error: 'Private IP addresses are not allowed' }
  }

  // Check for internal hostnames
  if (isInternalHostname(hostname)) {
    return { valid: false, error: 'Internal hostnames are not allowed' }
  }

  // Check for empty hostname
  if (!hostname) {
    return { valid: false, error: 'Invalid URL: missing hostname' }
  }

  // Normalize and return
  const normalizedUrl = normalizeUrl(urlToValidate)

  return { valid: true, url: normalizedUrl }
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
