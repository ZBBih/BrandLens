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

  // Calculate confidence
  let confidence = 30 // Base confidence
  if (allPhones.size > 0) confidence += 20
  if (allAddresses.size > 0) confidence += 25
  if (foundMaps) confidence += 10
  if (foundLocalSchema) confidence += 15

  const source = allPhones.size > 0 || allAddresses.size > 0 || foundLocalSchema
    ? 'extracted'
    : 'not_found'

  return {
    addresses: Array.from(allAddresses),
    phoneNumbers: Array.from(allPhones),
    hasGoogleMaps: foundMaps,
    hasLocalBusinessSchema: foundLocalSchema,
    locationPages,
    confidence: Math.min(confidence, 100),
    source,
    evidence: evidence.slice(0, 15),
  }
}
