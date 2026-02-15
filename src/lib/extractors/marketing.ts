/**
 * Marketing extractor - extracts marketing elements like CTAs, lead magnets, testimonials
 */

import { PageData } from '../crawler'
import { MarketingElement, MarketingData, Evidence } from './types'

// CTA patterns
const CTA_PATTERNS = [
  /get\s+started/i,
  /sign\s+up/i,
  /start\s+(free|your|now)/i,
  /try\s+(free|now|it)/i,
  /book\s+(a|demo|call)/i,
  /schedule\s+(a|demo|call)/i,
  /request\s+(a|demo|quote)/i,
  /download\s+(now|free|the)/i,
  /learn\s+more/i,
  /see\s+(how|pricing|demo)/i,
  /join\s+(now|us|free)/i,
  /subscribe/i,
  /contact\s+(us|sales)/i,
  /buy\s+now/i,
  /shop\s+now/i,
  /order\s+now/i,
  /add\s+to\s+cart/i,
  /claim\s+(your|free)/i,
]

// Newsletter/email capture patterns
const NEWSLETTER_PATTERNS = [
  /sign\s*up\s*(for|to)\s*(our)?\s*newsletter/i,
  /subscribe\s*(to)?\s*(our)?\s*(newsletter|updates|emails)/i,
  /join\s*(our)?\s*(mailing\s*list|newsletter)/i,
  /get\s*(our)?\s*(latest|weekly|monthly)\s*(news|updates)/i,
  /stay\s*(up\s*to\s*date|informed|connected)/i,
  /enter\s*your\s*email/i,
  /email\s*updates/i,
]

// Lead magnet patterns
const LEAD_MAGNET_PATTERNS = [
  /free\s+(guide|ebook|download|template|checklist|whitepaper|report|toolkit)/i,
  /download\s+(our|the|your)\s+(free)?/i,
  /get\s+(the|your|our)\s+(free)?\s*(guide|ebook|template)/i,
]

// Testimonial indicators
const TESTIMONIAL_PATTERNS = [
  /"[^"]{50,}"/,  // Quoted text over 50 chars
  /what\s+(our\s+)?(customers|clients|users)\s+say/i,
  /testimonials?/i,
  /reviews?/i,
  /success\s+stor(y|ies)/i,
  /case\s+stud(y|ies)/i,
]

// Trust badge patterns
const TRUST_PATTERNS = [
  /trusted\s+by/i,
  /used\s+by/i,
  /as\s+seen\s+(on|in)/i,
  /featured\s+(on|in)/i,
  /powered\s+by/i,
  /certified/i,
  /award[\s-]winning/i,
  /iso\s*\d+/i,
  /soc\s*2/i,
  /gdpr/i,
  /hipaa/i,
]

/**
 * Extract CTAs from page content
 */
function extractCtas(pages: PageData[]): MarketingElement[] {
  const elements: MarketingElement[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    // Check button text
    for (const cta of page.ctaButtons) {
      const lower = cta.toLowerCase()
      for (const pattern of CTA_PATTERNS) {
        if (pattern.test(lower) && !seen.has(lower)) {
          seen.add(lower)
          elements.push({
            type: 'cta',
            content: cta,
            url: page.url,
            confidence: 90,
            source: 'extracted',
            evidence: [{
              url: page.url,
              snippet: `Button: "${cta}"`,
              context: 'CTA button',
            }],
          })
          break
        }
      }
    }
  }

  return elements
}

/**
 * Extract newsletter signup elements
 */
function extractNewsletterSignups(pages: PageData[]): { elements: MarketingElement[]; language: string[] } {
  const elements: MarketingElement[] = []
  const language: string[] = []

  for (const page of pages) {
    const text = page.html

    for (const pattern of NEWSLETTER_PATTERNS) {
      const match = text.match(pattern)
      if (match) {
        const snippet = match[0]
        if (!language.includes(snippet)) {
          language.push(snippet)
          elements.push({
            type: 'email_capture',
            content: snippet,
            url: page.url,
            confidence: 85,
            source: 'extracted',
            evidence: [{
              url: page.url,
              snippet,
              context: 'Newsletter signup',
            }],
          })
        }
      }
    }
  }

  return { elements, language }
}

/**
 * Extract lead magnets
 */
function extractLeadMagnets(pages: PageData[]): MarketingElement[] {
  const elements: MarketingElement[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    const text = page.html

    for (const pattern of LEAD_MAGNET_PATTERNS) {
      const match = text.match(pattern)
      if (match) {
        const snippet = match[0]
        if (!seen.has(snippet.toLowerCase())) {
          seen.add(snippet.toLowerCase())
          elements.push({
            type: 'lead_magnet',
            content: snippet,
            url: page.url,
            confidence: 80,
            source: 'extracted',
            evidence: [{
              url: page.url,
              snippet,
              context: 'Lead magnet',
            }],
          })
        }
      }
    }
  }

  return elements
}

/**
 * Extract testimonials
 */
function extractTestimonials(pages: PageData[]): MarketingElement[] {
  const elements: MarketingElement[] = []

  for (const page of pages) {
    // Check for testimonial section indicators
    for (const pattern of TESTIMONIAL_PATTERNS) {
      if (pattern.test(page.html)) {
        elements.push({
          type: 'testimonial',
          content: 'Testimonials section detected',
          url: page.url,
          confidence: 75,
          source: 'inferred',
          evidence: [{
            url: page.url,
            snippet: 'Page contains testimonial indicators',
            context: 'Testimonials',
          }],
        })
        break
      }
    }
  }

  return elements
}

/**
 * Extract trust badges and social proof
 */
function extractTrustBadges(pages: PageData[]): MarketingElement[] {
  const elements: MarketingElement[] = []
  const seen = new Set<string>()

  for (const page of pages) {
    const text = page.html

    for (const pattern of TRUST_PATTERNS) {
      const match = text.match(pattern)
      if (match) {
        const snippet = match[0]
        if (!seen.has(snippet.toLowerCase())) {
          seen.add(snippet.toLowerCase())
          elements.push({
            type: 'trust_badge',
            content: snippet,
            url: page.url,
            confidence: 80,
            source: 'extracted',
            evidence: [{
              url: page.url,
              snippet,
              context: 'Trust badge',
            }],
          })
        }
      }
    }
  }

  return elements
}

/**
 * Extract client logos
 */
function extractClientLogos(pages: PageData[]): MarketingElement[] {
  const elements: MarketingElement[] = []

  for (const page of pages) {
    // Look for images with client/logo related alt text or class names
    for (const img of page.images) {
      const alt = img.alt.toLowerCase()
      const src = img.src.toLowerCase()

      const isClientLogo = (
        alt.includes('logo') ||
        alt.includes('client') ||
        alt.includes('partner') ||
        alt.includes('customer') ||
        src.includes('logo') ||
        src.includes('client') ||
        src.includes('partner')
      ) && !alt.includes('our logo') && !src.includes('header')

      if (isClientLogo) {
        elements.push({
          type: 'client_logo',
          content: img.alt || 'Client logo',
          url: page.url,
          confidence: 70,
          source: 'inferred',
          evidence: [{
            url: page.url,
            snippet: `Image: ${img.alt || img.src.split('/').pop()}`,
            context: 'Client logo',
          }],
        })
      }
    }
  }

  // Limit to avoid noise
  return elements.slice(0, 10)
}

/**
 * Find campaign/landing pages
 */
function findCampaignPages(pages: PageData[]): MarketingElement[] {
  const elements: MarketingElement[] = []

  const campaignIndicators = [
    /\/lp\//i,
    /\/landing/i,
    /\/campaign/i,
    /\/promo/i,
    /\/offer/i,
    /\/special/i,
    /\/free-/i,
    /utm_/i,
  ]

  for (const page of pages) {
    for (const pattern of campaignIndicators) {
      if (pattern.test(page.url)) {
        elements.push({
          type: 'campaign_page',
          content: page.title || page.url,
          url: page.url,
          confidence: 85,
          source: 'extracted',
          evidence: [{
            url: page.url,
            snippet: `Campaign page: ${page.title || page.url}`,
            context: 'URL pattern',
          }],
        })
        break
      }
    }
  }

  return elements
}

/**
 * Extract CTA patterns from buttons
 */
function extractCtaPatterns(pages: PageData[]): string[] {
  const patterns = new Set<string>()

  for (const page of pages) {
    for (const cta of page.ctaButtons) {
      if (cta.length > 2 && cta.length < 50) {
        patterns.add(cta)
      }
    }
  }

  return Array.from(patterns).slice(0, 20)
}

/**
 * Extract marketing data from crawled pages
 */
export function extractMarketing(pages: PageData[]): MarketingData {
  const ctas = extractCtas(pages)
  const { elements: newsletters, language: newsletterLanguage } = extractNewsletterSignups(pages)
  const leadMagnets = extractLeadMagnets(pages)
  const testimonials = extractTestimonials(pages)
  const trustBadges = extractTrustBadges(pages)
  const clientLogos = extractClientLogos(pages)
  const campaignPages = findCampaignPages(pages)
  const ctaPatterns = extractCtaPatterns(pages)

  // Combine all elements
  const elements = [
    ...ctas,
    ...newsletters,
    ...leadMagnets,
    ...testimonials,
    ...trustBadges,
    ...clientLogos,
    ...campaignPages,
  ]

  return {
    elements,
    ctaPatterns,
    newsletterSignupLanguage: newsletterLanguage,
  }
}
