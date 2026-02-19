/**
 * GEO extractor - extracts local/geographic SEO signals
 */

import * as cheerio from 'cheerio'
import { PageData } from '../crawler'
import { GeoData, Evidence } from './types'

/**
 * Extract visible text from HTML (removes script, style, etc.)
 */
function getVisibleText(html: string): string {
  const $ = cheerio.load(html)
  // Remove script, style, and other non-visible elements
  $('script, style, noscript, iframe, svg, path').remove()
  // Get text content
  return $('body').text().replace(/\s+/g, ' ').trim()
}

/**
 * List of common street types for pattern matching
 */
const STREET_TYPES = [
  'Avenue', 'Ave',
  'Boulevard', 'Blvd',
  'Circle', 'Cir',
  'Court', 'Ct',
  'Drive', 'Dr',
  'Highway', 'Hwy',
  'Lane', 'Ln',
  'Parkway', 'Pkwy',
  'Place', 'Pl',
  'Road', 'Rd',
  'Square', 'Sq',
  'Street', 'St',
  'Terrace', 'Ter',
  'Trail', 'Trl',
  'Way',
]

const STREET_TYPE_PATTERN = STREET_TYPES.join('|')

/**
 * Format address to standard format:
 * "1830 E Colonial Dr, Orlando FL, 32803"
 */
function formatAddress(addr: string): string | null {
  let formatted = addr.trim()

  // Remove common junk prefixes
  formatted = formatted.replace(/^00\s+/i, '')
  formatted = formatted.replace(/^UCF\s*/i, '')
  formatted = formatted.replace(/^(CONTACT\s*US|Please\s*fill|fill\s*out)[^0-9]*/gi, '')

  // Clean up extra whitespace
  formatted = formatted.replace(/\s+/g, ' ').trim()

  // Must start with a street number
  if (!/^\d+/.test(formatted)) {
    return null
  }

  // Pre-process: Fix concatenated text patterns
  // "AveTampa" -> "Ave Tampa", "DrOrlando" -> "Dr Orlando"
  formatted = formatted.replace(
    new RegExp(`(${STREET_TYPE_PATTERN})([A-Z][a-z])`, 'g'),
    '$1 $2'
  )

  // Fix "#324Orlando" -> "#324 Orlando"
  formatted = formatted.replace(/(#\d+[A-Za-z]?)([A-Z][a-z])/g, '$1 $2')

  // Fix "suite102Orlando" -> "suite 102 Orlando"
  formatted = formatted.replace(/([Ss]uite|[Ss]te)(\d+)/g, '$1 $2')
  formatted = formatted.replace(/(\d+)([A-Z][a-z]{2,})/g, '$1 $2')

  // Fix state running into zip: "FL32714" -> "FL 32714"
  formatted = formatted.replace(/([A-Z]{2})(\d{5})/g, '$1 $2')

  // Fix comma issues: ", FL" -> " FL" (no comma between city and state)
  formatted = formatted.replace(/,\s*([A-Z]{2})\s*,?\s*(\d{5})/g, ' $1, $2')

  // Now try to parse the address
  // Pattern with ZIP code (required for valid address)
  const fullPattern = new RegExp(
    `^(\\d+[^,]*?\\b(?:${STREET_TYPE_PATTERN})\\b)` +  // Street with type
    `(?:\\s*(#\\d+[A-Za-z]?|[Ss]uite\\s*\\d+[A-Za-z]?|[Ss]te\\s*\\d+[A-Za-z]?))?` +  // Suite
    `[,\\s]+` +
    `([A-Za-z][A-Za-z\\s]*?)` +  // City
    `[,\\s]*` +
    `([A-Z]{2})` +  // State
    `[,\\s]+` +
    `(\\d{5}(?:-\\d{4})?)`,  // ZIP (required)
    'i'
  )

  let match = formatted.match(fullPattern)

  if (match) {
    const streetPart = match[1].trim()
    const suitePart = match[2] ? match[2].trim() : ''
    let city = match[3].trim()
    const state = match[4].toUpperCase()
    const zip = match[5]

    // Clean up city - remove trailing comma or extra spaces
    city = city.replace(/,\s*$/, '').trim()

    // Build formatted address
    let result = streetPart
    if (suitePart) {
      const normalizedSuite = suitePart.replace(/[Ss]uite\s*/i, '#').replace(/[Ss]te\s*/i, '#')
      result += ` ${normalizedSuite}`
    }
    result += `, ${city} ${state}, ${zip}`

    return result
  }

  // Try alternate pattern: "4498 N Alafaya Trail #324 Orlando FL 32803" (no commas)
  const altPattern = new RegExp(
    `^(\\d+\\s+[NSEW]?\\s*[A-Za-z\\s]+\\b(?:${STREET_TYPE_PATTERN})\\b)` +
    `(?:\\s*(#\\d+[A-Za-z]?))?` +
    `\\s+([A-Za-z][A-Za-z\\s]*?)` +
    `\\s+([A-Z]{2})` +
    `\\s+(\\d{5}(?:-\\d{4})?)`,
    'i'
  )

  match = formatted.match(altPattern)

  if (match) {
    const streetPart = match[1].trim()
    const suitePart = match[2] ? match[2].trim() : ''
    let city = match[3].trim()
    const state = match[4].toUpperCase()
    const zip = match[5]

    let result = streetPart
    if (suitePart) {
      result += ` ${suitePart}`
    }
    result += `, ${city} ${state}, ${zip}`

    return result
  }

  return null
}

/**
 * Check if a string is junk/non-address content
 */
function isJunkContent(str: string): boolean {
  const junkPatterns = [
    /^contact\s*us/i,
    /please\s*fill/i,
    /submit\s*form/i,
    /get\s*in\s*touch/i,
    /send\s*us/i,
    /reach\s*out/i,
    /call\s*us/i,
    /email\s*us/i,
    /form\s*be/i,
    /subscribe/i,
    /newsletter/i,
    /sign\s*up/i,
    /follow\s*us/i,
    /privacy\s*policy/i,
    /terms\s*(of|and)/i,
    /copyright/i,
    /all\s*rights/i,
    /^\d{1,2}:\d{2}/,  // Time patterns like "9:00"
    /hours?:/i,
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i,
    /^suite\s*\d+[A-Za-z]?$/i,  // Just "suite 102" with nothing else
  ]

  return junkPatterns.some(pattern => pattern.test(str))
}

/**
 * Check if address is just city/state/zip with no street
 */
function isPartialAddress(addr: string): boolean {
  // Pattern for just "City, ST ZIP" or "City ST, ZIP" or "City ST ZIP"
  const partialPatterns = [
    /^[A-Za-z\s]+,?\s*[A-Z]{2},?\s*\d{5}(-\d{4})?$/,  // "Orlando FL, 32826"
    /^[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5}(-\d{4})?$/,     // "Orlando, FL 32826"
    /^[A-Z]{2}\s*,?\s*\d{5}(-\d{4})?$/,               // "FL, 32826"
  ]

  // Also check if it doesn't have a street type
  const hasStreetType = new RegExp(`\\b(${STREET_TYPE_PATTERN})\\b`, 'i').test(addr)

  return !hasStreetType || partialPatterns.some(p => p.test(addr.trim()))
}

/**
 * Clean and validate an address - returns null if invalid
 */
function cleanAddress(addr: string): string | null {
  // Filter out junk content first
  if (isJunkContent(addr)) {
    return null
  }

  // Filter out partial addresses (just city/state/zip)
  if (isPartialAddress(addr)) {
    return null
  }

  // Try to format the address
  const formatted = formatAddress(addr)

  if (!formatted) {
    return null
  }

  // Strict validation for real addresses:
  // 1. Must start with street number
  const hasStreetNumber = /^\d+\s/.test(formatted)
  if (!hasStreetNumber) return null

  // 2. Must have a street type
  const hasStreetType = new RegExp(`\\b(${STREET_TYPE_PATTERN})\\b`, 'i').test(formatted)
  if (!hasStreetType) return null

  // 3. Must have city and state in format "City STATE"
  const hasCityState = /,\s*[A-Za-z][A-Za-z\s]+\s+[A-Z]{2}(?:\s*,|\s*$)/.test(formatted)
  if (!hasCityState) return null

  // 4. Must have a 5-digit ZIP code (indicates complete address)
  const hasZip = /\b\d{5}(-\d{4})?\b/.test(formatted)
  if (!hasZip) return null

  // 5. Validate format: "Street, City STATE, ZIP"
  const validFormat = /^\d+[^,]+,\s*[A-Za-z][A-Za-z\s]+\s+[A-Z]{2},\s*\d{5}(-\d{4})?$/.test(formatted)
  if (!validFormat) return null

  // Must be reasonable length
  if (formatted.length < 25 || formatted.length > 100) {
    return null
  }

  return formatted
}

/**
 * Extract the core street address for deduplication
 * Returns: street number + street name + street type (normalized)
 */
function extractStreetKey(addr: string): string {
  // Extract just the street part (before the first comma)
  const streetPart = addr.split(',')[0].toLowerCase()

  // Normalize street types to abbreviations
  const normalized = streetPart
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bcircle\b/g, 'cir')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\bhighway\b/g, 'hwy')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bparkway\b/g, 'pkwy')
    .replace(/\bplace\b/g, 'pl')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bsquare\b/g, 'sq')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bterrace\b/g, 'ter')
    .replace(/\btrail\b/g, 'trl')
    .replace(/\beast\b/g, 'e')
    .replace(/\bwest\b/g, 'w')
    .replace(/\bnorth\b/g, 'n')
    .replace(/\bsouth\b/g, 's')

  // Remove all non-alphanumeric except spaces
  return normalized.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Deduplicate addresses, keeping the most complete version
 */
function deduplicateAddresses(addresses: string[]): string[] {
  const seen = new Map<string, string>()  // streetKey -> full address

  for (const addr of addresses) {
    const streetKey = extractStreetKey(addr)

    // Check if we've seen this street address before
    const existing = seen.get(streetKey)

    if (existing) {
      // Keep the one with the ZIP code, or the longer one
      const existingHasZip = /\d{5}/.test(existing)
      const newHasZip = /\d{5}/.test(addr)

      if (newHasZip && !existingHasZip) {
        seen.set(streetKey, addr)
      } else if (newHasZip === existingHasZip && addr.length > existing.length) {
        seen.set(streetKey, addr)
      }
    } else {
      seen.set(streetKey, addr)
    }
  }

  return Array.from(seen.values())
}

/**
 * Process and clean all extracted addresses
 */
export function processAddresses(rawAddresses: string[]): string[] {
  // Clean each address
  const cleaned = rawAddresses
    .map(cleanAddress)
    .filter((addr): addr is string => addr !== null)

  // Deduplicate
  return deduplicateAddresses(cleaned)
}

/**
 * Extract addresses from structured HTML (looks for location cards/divs)
 */
function extractAddressesFromHtml(html: string): string[] {
  const $ = cheerio.load(html)
  const addresses: string[] = []

  // Look for common address containers
  const addressSelectors = [
    '[itemtype*="PostalAddress"]',
    '[itemprop="address"]',
    '.address',
    '.location-address',
    '.store-address',
    '[class*="address"]',
    '[class*="location"]',
  ]

  for (const selector of addressSelectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim()
      if (text.length > 10 && text.length < 200) {
        // Check if it looks like an address
        if (/\d+.*(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|trail|blvd)/i.test(text) ||
            /[A-Z]{2}\s*,?\s*\d{5}/.test(text)) {
          addresses.push(text)
        }
      }
    })
  }

  // Also look for schema.org address data in the HTML
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text())
      const extractFromSchema = (obj: any) => {
        if (!obj) return
        if (obj.address) {
          if (typeof obj.address === 'string') {
            addresses.push(obj.address)
          } else if (obj.address.streetAddress) {
            const parts = [
              obj.address.streetAddress,
              obj.address.addressLocality,
              obj.address.addressRegion,
              obj.address.postalCode
            ].filter(Boolean)
            addresses.push(parts.join(', '))
          }
        }
        // Check @graph for multiple locations
        if (Array.isArray(obj['@graph'])) {
          obj['@graph'].forEach(extractFromSchema)
        }
      }
      extractFromSchema(json)
    } catch {
      // Invalid JSON
    }
  })

  return addresses
}

// Phone number patterns (US and international)
const PHONE_PATTERNS = [
  /\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
  /\+?[0-9]{1,4}[-.\s]?[0-9]{2,4}[-.\s]?[0-9]{3,4}[-.\s]?[0-9]{3,4}/g,
]

// Address patterns (simplified)
const ADDRESS_INDICATORS = [
  // Street address with common road types
  /\d+\s+[NSEW]?\s*[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|circle|cir|trail|trl|parkway|pkwy|highway|hwy|terrace|ter|square|sq)\b[^,\n]{0,30}/gi,
  // Suite/unit numbers
  /(?:suite|ste|unit|#)\s*\d+[a-z]?/gi,
  // US ZIP pattern: FL 32826 or FL, 32826
  /[A-Z]{2}\s*,?\s*\d{5}(?:-\d{4})?/g,
  // Canadian postal code
  /[A-Z]\d[A-Z]\s*\d[A-Z]\d/gi,
  // Full address: number + street, city state zip
  /\d+\s+[^,]{5,40},\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*,?\s*\d{5}/gi,
  // City, State ZIP pattern
  /[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*,?\s+[A-Z]{2}\s*,?\s*\d{5}/g,
]

// Google Maps embed patterns
const MAPS_PATTERNS = [
  /maps\.google\.com/i,
  /google\.com\/maps/i,
  /goo\.gl\/maps/i,
  /maps\.googleapis\.com/i,
]

// Location page URL patterns
const LOCATION_URL_PATTERNS = [
  /\/location/i,
  /\/locations/i,
  /\/store-locator/i,
  /\/stores/i,
  /\/find-us/i,
  /\/branches/i,
  /\/offices/i,
  /\/contact/i,
]

/**
 * Extract phone numbers from text
 */
function extractPhoneNumbers(text: string): string[] {
  const phones = new Set<string>()

  for (const pattern of PHONE_PATTERNS) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const phone = match[0].trim()
      // Basic validation: should have at least 10 digits
      const digits = phone.replace(/\D/g, '')
      if (digits.length >= 10 && digits.length <= 15) {
        phones.add(phone)
      }
    }
  }

  return Array.from(phones)
}

/**
 * Check if a string looks like a hex color code
 */
function isHexColor(str: string): boolean {
  return /^#?[0-9a-fA-F]{3,8}$/.test(str.trim())
}

/**
 * Check if a string is a valid address (not CSS/code artifacts)
 */
function isValidAddress(str: string): boolean {
  const trimmed = str.trim()

  // Filter out hex color codes
  if (isHexColor(trimmed)) return false

  // Filter out CSS-like values
  if (/^(rgb|rgba|hsl|hsla|var|calc|url)\(/i.test(trimmed)) return false

  // Filter out pure numbers
  if (/^\d+$/.test(trimmed)) return false

  // Filter out short strings (less than 10 chars unlikely to be address)
  if (trimmed.length < 10) return false

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) return false

  // Should have street-like words or ZIP code pattern
  const hasStreetWord = /(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|circle|cir|highway|hwy|parkway|pkwy|suite|ste|floor|unit|building|bldg|trail|trl|terrace|ter|square|sq)/i.test(trimmed)
  const hasZipCode = /\b\d{5}(?:-\d{4})?\b/.test(trimmed) || /\b[A-Z]\d[A-Z]\s*\d[A-Z]\d\b/i.test(trimmed)
  const hasCity = /,\s*[A-Za-z\s]+,?\s*[A-Z]{2}\b/.test(trimmed) // City, State pattern
  const hasStateZip = /\b[A-Z]{2}\s*,?\s*\d{5}\b/.test(trimmed) // FL 32826 or FL, 32826
  const hasStreetNumber = /^\d+\s+[NSEW]?\s*[A-Za-z]/.test(trimmed) // Starts with number and direction

  return hasStreetWord || hasZipCode || hasCity || hasStateZip || hasStreetNumber
}

/**
 * Extract addresses from text
 */
function extractAddresses(text: string): string[] {
  const addresses = new Set<string>()

  // Look for address-like patterns
  for (const pattern of ADDRESS_INDICATORS) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const addr = match[0].trim()
      if (isValidAddress(addr)) {
        addresses.add(addr)
      }
    }
  }

  // Also try to find full addresses with a more aggressive pattern
  // Matches: "123 Main Street, City, ST 12345" or "123 Main St City ST 12345"
  const fullAddressPattern = /\d{1,5}\s+[A-Za-z0-9\s\.]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|place|pl|circle|cir|trail|trl|parkway|pkwy|highway|hwy)[^a-z]*(?:#\d+|suite\s*\d+|ste\s*\d+|unit\s*\d+)?[^a-z]*[A-Za-z\s]+,?\s*[A-Z]{2}\s*,?\s*\d{5}/gi
  const fullMatches = text.matchAll(fullAddressPattern)
  for (const match of fullMatches) {
    const addr = match[0].trim()
    if (addr.length > 15 && addr.length < 150) {
      addresses.add(addr)
    }
  }

  return Array.from(addresses)
}

/**
 * Check for Google Maps embeds
 */
function hasGoogleMapsEmbed(html: string): boolean {
  for (const pattern of MAPS_PATTERNS) {
    if (pattern.test(html)) {
      return true
    }
  }
  return false
}

/**
 * Check for LocalBusiness schema
 */
function hasLocalBusinessSchema(schemas: Record<string, unknown>[]): boolean {
  const localTypes = [
    'LocalBusiness',
    'Restaurant',
    'Store',
    'MedicalBusiness',
    'LegalService',
    'FinancialService',
    'RealEstateAgent',
    'AutoDealer',
    'Hotel',
    'SportsActivityLocation',
    'EntertainmentBusiness',
    'FoodEstablishment',
  ]

  for (const schema of schemas) {
    const type = schema['@type']
    if (typeof type === 'string' && localTypes.some(lt => type.includes(lt))) {
      return true
    }
    if (Array.isArray(type) && type.some(t => localTypes.some(lt => t.includes(lt)))) {
      return true
    }
  }

  return false
}

/**
 * Find location-related pages
 */
function findLocationPages(pages: PageData[]): string[] {
  const locationPages: string[] = []

  for (const page of pages) {
    for (const pattern of LOCATION_URL_PATTERNS) {
      if (pattern.test(page.url)) {
        locationPages.push(page.url)
        break
      }
    }
  }

  return locationPages
}

/**
 * Extract address from LocalBusiness schema
 */
function extractSchemaAddress(schemas: Record<string, unknown>[]): string[] {
  const addresses: string[] = []

  for (const schema of schemas) {
    const address = schema['address'] as Record<string, unknown> | undefined
    if (address) {
      const parts: string[] = []
      if (address['streetAddress']) parts.push(String(address['streetAddress']))
      if (address['addressLocality']) parts.push(String(address['addressLocality']))
      if (address['addressRegion']) parts.push(String(address['addressRegion']))
      if (address['postalCode']) parts.push(String(address['postalCode']))
      if (parts.length > 0) {
        addresses.push(parts.join(', '))
      }
    }
  }

  return addresses
}

/**
 * Detect if this is a multi-location business
 */
function detectMultiLocation(
  pages: PageData[],
  locationPages: string[],
  rawAddressCount: number,
  cleanedAddressCount: number
): { isMultiLocation: boolean; locationsPageUrl?: string } {
  // Check for explicit locations/store-locator pages
  const locationsPage = locationPages.find(url =>
    /\/locations?\/?$|\/store-locator|\/stores\/?$|\/find-us|\/find-a-location/i.test(url)
  )

  if (locationsPage) {
    return { isMultiLocation: true, locationsPageUrl: locationsPage }
  }

  // Check page content for multi-location indicators
  for (const page of pages) {
    const text = page.html.toLowerCase()

    // Look for "find a location", "store locator", "locations near you", etc.
    const multiLocationIndicators = [
      'find a location',
      'find your nearest',
      'store locator',
      'locations near',
      'nearest location',
      'find a store',
      'our locations',
      'view all locations',
      'search locations',
      'enter your zip',
      'enter your city',
      'find us near you',
    ]

    if (multiLocationIndicators.some(indicator => text.includes(indicator))) {
      // Try to find a locations link
      const locationLinkMatch = page.html.match(/href=["']([^"']*(?:location|store|find)[^"']*)["']/i)
      const locUrl = locationLinkMatch ? locationLinkMatch[1] : undefined

      // Build full URL if relative
      let fullLocUrl = locUrl
      if (locUrl && !locUrl.startsWith('http')) {
        try {
          const baseUrl = new URL(page.url)
          fullLocUrl = new URL(locUrl, baseUrl).href
        } catch {
          fullLocUrl = locUrl
        }
      }

      return { isMultiLocation: true, locationsPageUrl: fullLocUrl }
    }
  }

  // If we found many raw addresses but they didn't clean/validate well, might be multi-location
  if (rawAddressCount > 3 && cleanedAddressCount === 0) {
    // Look for a locations page link in nav or footer
    for (const page of pages) {
      const locationLinkMatch = page.html.match(/href=["']([^"']*\/locations?\/?[^"']*)["']/i)
      if (locationLinkMatch) {
        let locUrl = locationLinkMatch[1]
        if (!locUrl.startsWith('http')) {
          try {
            const baseUrl = new URL(page.url)
            locUrl = new URL(locUrl, baseUrl).href
          } catch {
            // Keep relative URL
          }
        }
        return { isMultiLocation: true, locationsPageUrl: locUrl }
      }
    }
  }

  return { isMultiLocation: false }
}

/**
 * Extract GEO data from crawled pages
 */
export function extractGeo(pages: PageData[]): GeoData {
  const evidence: Evidence[] = []
  const allPhones = new Set<string>()
  const allAddresses = new Set<string>()
  let foundMaps = false
  let foundLocalSchema = false
  const locationPages: string[] = []

  // Collect all schemas
  const allSchemas: Record<string, unknown>[] = []
  for (const page of pages) {
    allSchemas.push(...page.schemaData)
  }

  // Check for LocalBusiness schema
  foundLocalSchema = hasLocalBusinessSchema(allSchemas)

  // Extract addresses from schema
  const schemaAddresses = extractSchemaAddress(allSchemas)
  schemaAddresses.forEach(addr => allAddresses.add(addr))

  for (const page of pages) {
    // Focus on location/contact pages - search visible text, otherwise just footer
    const isLocationPage = /contact|location|about|stores|find-us|branches|offices|menu/i.test(page.url)
    // Get visible text from HTML (removes scripts, styles, etc.)
    const visibleText = isLocationPage ? getVisibleText(page.html) : page.footerContent

    // Extract phone numbers
    const phones = extractPhoneNumbers(visibleText)
    phones.forEach(p => {
      allPhones.add(p)
      evidence.push({
        url: page.url,
        snippet: `Phone: ${p}`,
        context: isLocationPage ? 'Location page' : 'Footer',
      })
    })

    // Extract addresses from visible text
    const addresses = extractAddresses(visibleText)
    addresses.forEach(a => {
      allAddresses.add(a)
      evidence.push({
        url: page.url,
        snippet: `Address: ${a}`,
        context: isLocationPage ? 'Location page' : 'Footer',
      })
    })

    // Also try HTML structure-based extraction for location pages
    if (isLocationPage) {
      const htmlAddresses = extractAddressesFromHtml(page.html)
      htmlAddresses.forEach(a => {
        allAddresses.add(a)
        evidence.push({
          url: page.url,
          snippet: `Address: ${a}`,
          context: 'Structured HTML',
        })
      })
    }

    // Check for Google Maps
    if (!foundMaps && hasGoogleMapsEmbed(page.html)) {
      foundMaps = true
      evidence.push({
        url: page.url,
        snippet: 'Google Maps embed detected',
        context: 'Page embed',
      })
    }

    // Check for location pages
    for (const pattern of LOCATION_URL_PATTERNS) {
      if (pattern.test(page.url) && !locationPages.includes(page.url)) {
        locationPages.push(page.url)
      }
    }
  }

  // Track raw address count before cleaning
  const rawAddressCount = allAddresses.size

  // Process and clean addresses
  const cleanedAddresses = processAddresses(Array.from(allAddresses))

  // Detect if this is a multi-location business
  const multiLocationInfo = detectMultiLocation(pages, locationPages, rawAddressCount, cleanedAddresses.length)

  // Build multi-location message if applicable
  let multiLocationMessage: string | undefined
  if (multiLocationInfo.isMultiLocation && cleanedAddresses.length === 0) {
    // Get domain for the message
    let domain = ''
    try {
      domain = new URL(pages[0]?.url || '').hostname.replace('www.', '')
    } catch {
      domain = 'website'
    }

    if (multiLocationInfo.locationsPageUrl) {
      multiLocationMessage = `Multiple locations - visit ${domain}/locations`
    } else {
      multiLocationMessage = `Multiple locations - visit ${domain} for addresses`
    }
  }

  // Calculate confidence
  let confidence = 30 // Base confidence
  if (allPhones.size > 0) confidence += 20
  if (cleanedAddresses.length > 0) confidence += 25
  if (foundMaps) confidence += 10
  if (foundLocalSchema) confidence += 15
  if (multiLocationInfo.isMultiLocation) confidence += 10

  const source = allPhones.size > 0 || cleanedAddresses.length > 0 || foundLocalSchema || multiLocationInfo.isMultiLocation
    ? 'extracted'
    : 'not_found'

  return {
    addresses: cleanedAddresses,
    phoneNumbers: Array.from(allPhones),
    hasGoogleMaps: foundMaps,
    hasLocalBusinessSchema: foundLocalSchema,
    locationPages,
    isMultiLocation: multiLocationInfo.isMultiLocation,
    multiLocationMessage,
    locationsPageUrl: multiLocationInfo.locationsPageUrl,
    confidence: Math.min(confidence, 100),
    source,
    evidence: evidence.slice(0, 15),
  }
}
