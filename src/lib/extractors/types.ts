/**
 * Shared types for extraction modules
 */

/**
 * Where a datum came from:
 * - verified: claimed by the brand owner (Brandfetch claimed brand)
 * - third_party: an unclaimed third-party dataset (Brandfetch, unclaimed)
 * - extracted: measured from the crawled site
 * - inferred: derived by heuristics or the LLM
 * - not_found: nothing could be determined
 */
export type DataSource = 'verified' | 'third_party' | 'extracted' | 'inferred' | 'not_found'

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
  availableFonts?: { name: string; source: string; weights?: string[] }[]
  flags?: {
    canvasTextPossible: boolean
    textInImagesPossible: boolean
  }
  nonInspectableTextWarning?: string | null
  extractionStats?: {
    totalElementsScanned: number
    headingElementsCount: number
    bodyElementsCount: number
    confidence: number
  }
}

// Color types
export interface ColorEntry extends ExtractedData {
  hex: string
  rgb: { r: number; g: number; b: number }
  role: 'primary' | 'secondary' | 'accent' | 'background' | 'text' | 'other'
  cssVariable?: string
  /** Share (0-1) of rendered pixel area in the sampled viewports, when measured */
  areaShare?: number
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
  // Multi-location support
  isMultiLocation?: boolean
  multiLocationMessage?: string
  locationsPageUrl?: string
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
export type ConsistencyDimension = 'color' | 'typography' | 'tone' | 'seo' | 'message'

export type ConsistencyGrade = 'A' | 'B' | 'C' | 'D' | 'F'

/**
 * One scored dimension. When there is not enough data to judge it, `score`
 * is null and `status` is 'insufficient_data' (never full marks).
 */
export interface DimensionScore {
  score: number | null
  max: number        // color 25, typography 20, tone 25, seo 15, message 15
  status: 'scored' | 'insufficient_data'
  reason?: string    // why the dimension could not be scored
}

export type ConsistencyBreakdown = Record<ConsistencyDimension, DimensionScore>

export interface ConsistencyData {
  /** 0-100: scored dimensions scaled over their combined max; null when none could be scored */
  score: number | null
  /** null when fewer than 3 pages were crawled or fewer than 3 dimensions were scored */
  grade: ConsistencyGrade | null
  breakdown: ConsistencyBreakdown
  issues: string[]
  /** Human-readable reasons, e.g. "color: no brand colors were extracted" */
  insufficientData: string[]
  pagesAnalyzed: number
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

// AI Insights types
export interface AIInsights {
  executiveSummary: string
  actionItems: string[]
  scoreExplanation: string
  competitorPositioning: string
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
  aiInsights?: AIInsights
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
