/**
 * Shared types for extraction modules
 */

export type DataSource = 'verified' | 'extracted' | 'inferred' | 'not_found'

export interface Evidence {
  url: string
  snippet: string
  context?: string
}

export interface ExtractedData {
  confidence: number // 0-100
  source: DataSource
  evidence: Evidence[]
}

// Typography types
export interface FontEntry extends ExtractedData {
  name: string
  role: 'primary' | 'secondary' | 'heading' | 'button' | 'accent'
  variants?: string[]
  googleFontsUrl?: string
}

export interface TypographyData {
  fonts: FontEntry[]
  googleFontsDetected: boolean
}

// Color types
export interface ColorEntry extends ExtractedData {
  hex: string
  rgb: { r: number; g: number; b: number }
  role: 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'other'
  cssVariable?: string
}

export interface ColorData {
  colors: ColorEntry[]
}

// SEO types
export interface SEOItem {
  type: 'title' | 'description' | 'h1' | 'schema' | 'og' | 'canonical'
  status: 'good' | 'warning' | 'bad'
  headline: string
  detail: string
  action?: string
  affectedPages?: string[]
}

export interface GooglePreview {
  title: string
  url: string
  description: string
}

export interface SocialPreview {
  title: string
  description: string
  image: string | null
  siteName: string
}

export interface SeoData extends ExtractedData {
  // New user-friendly format
  score: number // 0-10
  wins: SEOItem[]
  issues: SEOItem[]
  googlePreview: GooglePreview
  socialPreview: SocialPreview
  // Raw data for evidence
  titlePattern: string
  hasCanonical: boolean
  schemaTypes: string[]
  schemas: Record<string, unknown>[]
  // Legacy fields for backwards compatibility
  titlePatterns: string[]
  descriptionPatterns: string[]
  h1Patterns: string[]
}

// GEO types
export interface GeoData extends ExtractedData {
  addresses: string[]
  phoneNumbers: string[]
  hasGoogleMaps: boolean
  hasLocalBusinessSchema: boolean
  locationPages: string[]
}

// Social types
export interface SocialLink extends ExtractedData {
  platform: 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'tiktok' | 'facebook' | 'other'
  url: string
  handle?: string
}

export interface SocialData {
  links: SocialLink[]
}

// Marketing types
export interface MarketingElement extends ExtractedData {
  type: 'campaign_page' | 'lead_magnet' | 'email_capture' | 'testimonial' | 'trust_badge' | 'client_logo' | 'cta'
  content: string
  url: string
}

export interface MarketingData {
  elements: MarketingElement[]
  ctaPatterns: string[]
  newsletterSignupLanguage: string[]
}

// Tone/Voice types
export interface ToneData extends ExtractedData {
  traits: string[]
  doList: string[]
  dontList: string[]
  sampleHeadlines: string[]
  sampleCtas: string[]
  styleNotes: string[]
}

// Brand Summary types
export interface BrandSummary extends ExtractedData {
  name: string
  description: string
  missionStatement?: string
  valueProposition?: string
  targetAudience?: string
  industry?: string
}

// Consistency Score types
export interface ConsistencyBreakdown {
  color: number      // 0-25
  typography: number // 0-20
  tone: number       // 0-25
  seo: number        // 0-15
  message: number    // 0-15
}

export interface ConsistencyData {
  score: number      // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  breakdown: ConsistencyBreakdown
  issues: string[]
}

// AI Generated Assets types
export interface GeneratedAssets {
  linkedinPost: string
  instagramPost: string
  twitterPost: string
  adHeadlines: string[]
  emailSubjects: string[]
  elevatorPitch: string
  ctaVariations: string[]
  generatedAt: string
}

// Full report data
export interface BrandReport {
  id: string
  domain: string
  brandName: string
  logoUrl?: string
  summary: BrandSummary
  typography: TypographyData
  colors: ColorData
  seo: SeoData
  geo: GeoData
  social: SocialData
  marketing: MarketingData
  tone: ToneData
  consistency?: ConsistencyData
  generatedAssets?: GeneratedAssets
  crawlStats: {
    pagesProcessed: number
    duration: number
    errors: string[]
  }
  generatedAt: string
  cached: boolean
  // Public sharing
  slug?: string
  isPublic?: boolean
}
