/**
 * Mock data for development testing
 * Contains saved analysis results for fast UI iteration
 *
 * Usage: Set USE_MOCK_DATA=true in environment
 */

import { BrandReport } from '@/lib/extractors/types'

export interface MockBrand {
  domains: string[]
  report: BrandReport
}

// Nike - Global athletic brand
const nikeMockReport: BrandReport = {
  id: 'mock-nike-001',
  domain: 'nike.com',
  brandName: 'Nike',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/200px-Logo_NIKE.svg.png',
  slug: 'nike-mock',
  isPublic: false,
  summary: {
    name: 'Nike',
    description: 'Nike, Inc. is the world\'s largest supplier of athletic shoes and apparel and a major manufacturer of sports equipment. Founded in 1964 as Blue Ribbon Sports, Nike has grown into a global brand synonymous with athletic excellence, innovation, and the iconic "Just Do It" slogan.',
    valueProposition: 'Bring inspiration and innovation to every athlete in the world',
    targetAudience: 'Athletes of all levels, fitness enthusiasts, sports fans, and lifestyle consumers seeking premium athletic wear and footwear',
    industry: 'Athletic Apparel & Footwear',
    confidence: 98,
    source: 'verified',
    evidence: [
      { url: 'https://nike.com/', snippet: 'Just Do It. Nike.com', context: 'hero section' },
    ],
  },
  typography: {
    fonts: [
      {
        name: 'Helvetica Neue',
        role: 'primary',
        variants: ['400', '500', '700', '800'],
        confidence: 96,
        source: 'extracted',
        evidence: [{ url: 'https://nike.com/', snippet: "font-family: 'Helvetica Neue'", context: 'body CSS' }],
      },
      {
        name: 'Nike Futura',
        role: 'heading',
        variants: ['700', '800', '900'],
        confidence: 94,
        source: 'extracted',
        evidence: [{ url: 'https://nike.com/', snippet: "font-family: 'Nike Futura'", context: 'headline CSS' }],
      },
    ],
    googleFontsDetected: false,
  },
  colors: {
    colors: [
      { hex: '#111111', rgb: { r: 17, g: 17, b: 17 }, role: 'primary', cssVariable: '--nike-black', confidence: 98, source: 'extracted', evidence: [] },
      { hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, role: 'background', cssVariable: '--nike-white', confidence: 97, source: 'extracted', evidence: [] },
      { hex: '#FA5400', rgb: { r: 250, g: 84, b: 0 }, role: 'accent', cssVariable: '--nike-orange', confidence: 92, source: 'extracted', evidence: [] },
      { hex: '#7E7E7E', rgb: { r: 126, g: 126, b: 126 }, role: 'secondary', confidence: 90, source: 'extracted', evidence: [] },
    ],
  },
  seo: {
    score: 10,
    wins: [
      { type: 'title', status: 'good', headline: 'Strong brand presence in titles', detail: 'All page titles include "Nike"' },
      { type: 'description', status: 'good', headline: 'All pages have meta descriptions', detail: 'Action-oriented descriptions' },
      { type: 'schema', status: 'good', headline: 'Rich product schema implemented', detail: 'Products display with prices in search' },
    ],
    issues: [],
    googlePreview: { title: 'Nike. Just Do It. Nike.com', url: 'https://nike.com/', description: 'Shop the latest Nike shoes, clothing, and gear.' },
    socialPreview: { title: 'Nike. Just Do It.', description: 'Inspiring the world\'s athletes.', image: 'https://static.nike.com/og-default.jpg', siteName: 'Nike' },
    titlePattern: '[Product]. Nike.com',
    titlePatterns: ['Nike [Product] | Nike.com', '[Category] Shoes & Sneakers. Nike.com'],
    descriptionPatterns: ['Shop Nike [Category] for the latest...'],
    h1Patterns: ['Men\'s Shoes', 'Women\'s Clothing'],
    hasCanonical: true,
    schemaTypes: ['Organization', 'Product'],
    schemas: [],
    confidence: 96,
    source: 'extracted',
    evidence: [],
  },
  geo: {
    addresses: ['One Bowerman Drive, Beaverton, OR 97005'],
    phoneNumbers: ['1-800-806-6453'],
    hasGoogleMaps: true,
    hasLocalBusinessSchema: true,
    locationPages: ['/stores'],
    confidence: 94,
    source: 'extracted',
    evidence: [],
  },
  social: {
    links: [
      { platform: 'instagram', url: 'https://instagram.com/nike', handle: '@nike', confidence: 98, source: 'extracted', evidence: [] },
      { platform: 'twitter', url: 'https://twitter.com/nike', handle: '@nike', confidence: 98, source: 'extracted', evidence: [] },
      { platform: 'facebook', url: 'https://facebook.com/nike', confidence: 98, source: 'extracted', evidence: [] },
      { platform: 'youtube', url: 'https://youtube.com/nike', confidence: 98, source: 'extracted', evidence: [] },
    ],
  },
  marketing: {
    elements: [
      { type: 'cta', content: 'Just Do It.', url: 'https://nike.com/', confidence: 100, source: 'extracted', evidence: [] },
      { type: 'cta', content: 'Shop Now', url: 'https://nike.com/', confidence: 96, source: 'extracted', evidence: [] },
    ],
    ctaPatterns: ['Shop Now', 'Join Us', 'Find Your Store'],
    newsletterSignupLanguage: ['Be the first to know about new releases'],
  },
  tone: {
    traits: ['Bold', 'Empowering', 'Aspirational', 'Athletic', 'Confident'],
    doList: ['Use short, punchy sentences', 'Speak directly to the athlete', 'Lead with benefits'],
    dontList: ['Use passive language', 'Over-explain', 'Sound corporate'],
    sampleHeadlines: ['Just Do It.', 'Find Your Greatness', 'There Is No Finish Line'],
    sampleCtas: ['Shop Now', 'Find Your Store', 'Join Nike Membership'],
    styleNotes: ['Headlines are bold, often sentence fragments', 'Product copy is concise'],
    confidence: 95,
    source: 'inferred',
    evidence: [],
  },
  consistency: {
    score: 95,
    grade: 'A',
    breakdown: { color: 24, typography: 20, tone: 24, seo: 14, message: 13 },
    issues: ['Some regional sites have slight color variations'],
  },
  generatedAssets: {
    linkedinPost: "Every champion was once a contender who refused to give up.\n\nAt Nike, we believe greatness isn't reserved for the few. It's for anyone willing to put in the work.\n\n#JustDoIt #Nike",
    instagramPost: "Greatness is earned, never given.\n\nEvery early morning. Every extra rep. Every time you push past \"I can't.\"\n\n#JustDoIt #NikeRunning",
    twitterPost: "You don't need permission to be great.\n\nYou just need to start.\n\n#JustDoIt",
    adHeadlines: ['Just Do It. Find Your Greatness.', 'New Arrivals. Unlimited Potential.'],
    emailSubjects: ['Your exclusive early access is here', 'New drops just landed'],
    elevatorPitch: 'Nike is the world\'s leading athletic brand, bringing inspiration and innovation to every athlete in the world.',
    ctaVariations: ['Shop Now', 'Find Your Fit', 'Join Nike Membership'],
    generatedAt: new Date().toISOString(),
  },
  aiInsights: {
    executiveSummary: 'Nike demonstrates exceptional brand consistency across all digital touchpoints, earning an A grade (95/100). The brand\'s visual identity is immediately recognizable through its bold use of black and white with strategic orange accents.\n\nThe "Just Do It" messaging permeates every customer touchpoint. Nike\'s tone is consistently empowering and action-oriented, speaking directly to the athlete in everyone.',
    actionItems: [
      'Continue leveraging athlete partnerships for authentic storytelling',
      'Expand accessibility features to reinforce inclusive messaging',
      'Implement video schema markup on product pages',
    ],
    scoreExplanation: 'Nike\'s 95/100 consistency score reflects near-perfect brand execution. The 5-point deduction comes from minor variations in regional sites.',
    competitorPositioning: 'Nike leads competitors like Adidas and Under Armour in brand consistency and digital presence.',
    generatedAt: new Date().toISOString(),
  },
  crawlStats: { pagesProcessed: 25, duration: 12.4, errors: [] },
  generatedAt: new Date().toISOString(),
  cached: false,
}

// Sus Hi Eatstation - Fast casual Asian restaurant
const sushiMockReport: BrandReport = {
  id: 'mock-sushi-001',
  domain: 'sushieatstation.com',
  brandName: 'Sus Hi Eatstation',
  logoUrl: undefined,
  slug: 'sushi-eatstation-mock',
  isPublic: false,
  summary: {
    name: 'Sus Hi Eatstation',
    description: 'Sus Hi Eatstation is a fast-casual restaurant chain specializing in customizable Asian-inspired bowls, sushi burritos, and poke. Known for fresh ingredients and quick service, they offer a modern take on traditional Asian cuisine.',
    valueProposition: 'Fresh, customizable Asian cuisine made fast',
    targetAudience: 'Health-conscious millennials and Gen Z seeking quick, flavorful meals',
    industry: 'Fast Casual Restaurant',
    confidence: 85,
    source: 'extracted',
    evidence: [],
  },
  typography: {
    fonts: [
      {
        name: 'Montserrat',
        role: 'primary',
        variants: ['400', '600', '700'],
        confidence: 90,
        source: 'extracted',
        evidence: [],
      },
      {
        name: 'Open Sans',
        role: 'secondary',
        variants: ['400', '600'],
        confidence: 88,
        source: 'extracted',
        evidence: [],
      },
    ],
    googleFontsDetected: true,
  },
  colors: {
    colors: [
      { hex: '#E31837', rgb: { r: 227, g: 24, b: 55 }, role: 'primary', confidence: 95, source: 'extracted', evidence: [] },
      { hex: '#1A1A1A', rgb: { r: 26, g: 26, b: 26 }, role: 'secondary', confidence: 92, source: 'extracted', evidence: [] },
      { hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, role: 'background', confidence: 90, source: 'extracted', evidence: [] },
      { hex: '#F5F5F5', rgb: { r: 245, g: 245, b: 245 }, role: 'background', confidence: 85, source: 'extracted', evidence: [] },
    ],
  },
  seo: {
    score: 7,
    wins: [
      { type: 'title', status: 'good', headline: 'Clear brand name in titles', detail: 'Pages include restaurant name' },
      { type: 'og', status: 'good', headline: 'Social sharing optimized', detail: 'Menu photos shared well' },
    ],
    issues: [
      { type: 'description', status: 'warning', headline: 'Missing meta descriptions on some pages', detail: 'Location pages lack descriptions' },
    ],
    googlePreview: { title: 'Sus Hi Eatstation | Fresh Asian Bowls & Sushi Burritos', url: 'https://sushieatstation.com/', description: 'Build your perfect bowl with fresh ingredients.' },
    socialPreview: { title: 'Sus Hi Eatstation', description: 'Fresh Asian-inspired bowls', image: null, siteName: 'Sus Hi Eatstation' },
    titlePattern: 'Sus Hi Eatstation | [Page]',
    titlePatterns: ['Sus Hi Eatstation | [Page]'],
    descriptionPatterns: ['Build your perfect bowl...'],
    h1Patterns: ['Fresh Asian Bowls'],
    hasCanonical: true,
    schemaTypes: ['Restaurant', 'LocalBusiness'],
    schemas: [],
    confidence: 82,
    source: 'extracted',
    evidence: [],
  },
  geo: {
    addresses: ['Multiple locations in Florida'],
    phoneNumbers: [],
    hasGoogleMaps: true,
    hasLocalBusinessSchema: true,
    locationPages: ['/locations'],
    confidence: 80,
    source: 'extracted',
    evidence: [],
  },
  social: {
    links: [
      { platform: 'instagram', url: 'https://instagram.com/sushieatstation', handle: '@sushieatstation', confidence: 95, source: 'extracted', evidence: [] },
      { platform: 'facebook', url: 'https://facebook.com/sushieatstation', confidence: 92, source: 'extracted', evidence: [] },
    ],
  },
  marketing: {
    elements: [
      { type: 'cta', content: 'Order Online', url: 'https://sushieatstation.com/order', confidence: 95, source: 'extracted', evidence: [] },
      { type: 'cta', content: 'Find a Location', url: 'https://sushieatstation.com/locations', confidence: 90, source: 'extracted', evidence: [] },
    ],
    ctaPatterns: ['Order Now', 'Find a Location', 'View Menu'],
    newsletterSignupLanguage: ['Get exclusive offers'],
  },
  tone: {
    traits: ['Fresh', 'Fun', 'Approachable', 'Energetic', 'Casual'],
    doList: ['Use playful, energetic language', 'Highlight freshness and customization', 'Keep it casual and approachable'],
    dontList: ['Use formal or stuffy language', 'Overcomplicate the menu descriptions', 'Be boring'],
    sampleHeadlines: ['Build Your Perfect Bowl', 'Fresh. Fast. Flavorful.', 'Roll With It'],
    sampleCtas: ['Order Now', 'Find Us', 'See Menu'],
    styleNotes: ['Short, punchy headlines', 'Food-focused imagery', 'Bright, energetic colors'],
    confidence: 85,
    source: 'inferred',
    evidence: [],
  },
  consistency: {
    score: 78,
    grade: 'C',
    breakdown: { color: 20, typography: 16, tone: 18, seo: 12, message: 12 },
    issues: ['Inconsistent typography across pages', 'Some location pages have outdated styling'],
  },
  generatedAssets: {
    linkedinPost: "Fresh ingredients. Endless combinations. Your perfect bowl awaits.\n\nAt Sus Hi Eatstation, we believe lunch should be exciting. Build your bowl, your way.\n\n#SusHiEatstation #FreshFood",
    instagramPost: "That lunch break feeling when your bowl is *chef's kiss*\n\nPoke, sushi burrito, or classic bowl? What's your go-to?\n\n#SusHi #Foodie #BowlGoals",
    twitterPost: "Craving something fresh?\n\nOrder ahead and skip the line.\n\n#SusHiEatstation",
    adHeadlines: ['Build Your Bowl, Your Way', 'Fresh Never Tasted So Good'],
    emailSubjects: ['Your lunch, elevated', 'New seasonal ingredients just dropped'],
    elevatorPitch: 'Sus Hi Eatstation serves customizable Asian-inspired bowls with fresh ingredients, perfect for a quick, healthy meal.',
    ctaVariations: ['Order Now', 'Build Your Bowl', 'Find a Location'],
    generatedAt: new Date().toISOString(),
  },
  aiInsights: {
    executiveSummary: 'Sus Hi Eatstation has established a solid brand presence in the fast-casual dining space with a C+ consistency score (78/100). The brand successfully communicates freshness and customization but has room for improvement in digital consistency.\n\nStrengths include a clear value proposition and energetic visual identity. The red primary color stands out and communicates the brand\'s bold, fresh approach.',
    actionItems: [
      'Standardize typography across all location pages',
      'Add meta descriptions to all pages for better SEO',
      'Create consistent photo styling guidelines for food imagery',
    ],
    scoreExplanation: 'The 78/100 score reflects good fundamentals with room for improvement. Typography inconsistencies (-4 points) and SEO gaps (-3 points) are the main areas for improvement.',
    competitorPositioning: 'In the fast-casual Asian food segment, Sus Hi competes with Poke Bar, Pokeworks, and local sushi spots. Their customization focus is a differentiator.',
    generatedAt: new Date().toISOString(),
  },
  crawlStats: { pagesProcessed: 12, duration: 8.2, errors: [] },
  generatedAt: new Date().toISOString(),
  cached: false,
}

// Yard House - Casual dining restaurant chain
const yardHouseMockReport: BrandReport = {
  id: 'mock-yardhouse-001',
  domain: 'yardhouse.com',
  brandName: 'Yard House',
  logoUrl: 'https://www.yardhouse.com/assets/images/logo.png',
  slug: 'yard-house-mock',
  isPublic: false,
  summary: {
    name: 'Yard House',
    description: 'Yard House is an upscale-casual American restaurant chain known for its extensive draft beer selection (100+ taps) and classic American dishes with a twist. Part of the Darden Restaurant family, they offer a lively atmosphere perfect for groups and sports viewing.',
    valueProposition: 'The ultimate beer and food experience with the largest selection of draft beers in America',
    targetAudience: 'Beer enthusiasts, casual diners, sports fans, and groups looking for a lively atmosphere',
    industry: 'Casual Dining Restaurant',
    confidence: 92,
    source: 'extracted',
    evidence: [],
  },
  typography: {
    fonts: [
      {
        name: 'Bebas Neue',
        role: 'heading',
        variants: ['400', '700'],
        confidence: 88,
        source: 'extracted',
        evidence: [],
      },
      {
        name: 'Roboto',
        role: 'secondary',
        variants: ['400', '500', '700'],
        confidence: 90,
        source: 'extracted',
        evidence: [],
      },
    ],
    googleFontsDetected: true,
  },
  colors: {
    colors: [
      { hex: '#C8102E', rgb: { r: 200, g: 16, b: 46 }, role: 'primary', cssVariable: '--yh-red', confidence: 95, source: 'extracted', evidence: [] },
      { hex: '#1C1C1C', rgb: { r: 28, g: 28, b: 28 }, role: 'secondary', confidence: 93, source: 'extracted', evidence: [] },
      { hex: '#D4AF37', rgb: { r: 212, g: 175, b: 55 }, role: 'accent', confidence: 88, source: 'extracted', evidence: [] },
      { hex: '#F8F8F8', rgb: { r: 248, g: 248, b: 248 }, role: 'background', confidence: 85, source: 'extracted', evidence: [] },
    ],
  },
  seo: {
    score: 8,
    wins: [
      { type: 'title', status: 'good', headline: 'Consistent title structure', detail: 'All pages follow brand guidelines' },
      { type: 'schema', status: 'good', headline: 'Restaurant schema implemented', detail: 'Menu and location data structured' },
      { type: 'canonical', status: 'good', headline: 'Proper canonical URLs', detail: 'Prevents duplicate content' },
    ],
    issues: [
      { type: 'h1', status: 'warning', headline: 'Multiple H1s on some pages', detail: 'Menu pages have hierarchy issues' },
    ],
    googlePreview: { title: 'Yard House | 100+ Taps of Craft Beer & Great Food', url: 'https://yardhouse.com/', description: 'Discover America\'s largest selection of draft beer paired with classic American food.' },
    socialPreview: { title: 'Yard House', description: 'The ultimate beer and food destination', image: 'https://yardhouse.com/og-image.jpg', siteName: 'Yard House' },
    titlePattern: 'Yard House | [Page]',
    titlePatterns: ['Yard House | [Page]', 'Menu | Yard House'],
    descriptionPatterns: ['Discover America\'s largest selection...'],
    h1Patterns: ['100+ Taps', 'Menu'],
    hasCanonical: true,
    schemaTypes: ['Restaurant', 'Menu', 'LocalBusiness'],
    schemas: [],
    confidence: 88,
    source: 'extracted',
    evidence: [],
  },
  geo: {
    addresses: ['Multiple locations nationwide'],
    phoneNumbers: [],
    hasGoogleMaps: true,
    hasLocalBusinessSchema: true,
    locationPages: ['/locations'],
    confidence: 90,
    source: 'extracted',
    evidence: [],
  },
  social: {
    links: [
      { platform: 'instagram', url: 'https://instagram.com/yardhouse', handle: '@yardhouse', confidence: 95, source: 'extracted', evidence: [] },
      { platform: 'twitter', url: 'https://twitter.com/yardhouse', handle: '@yardhouse', confidence: 95, source: 'extracted', evidence: [] },
      { platform: 'facebook', url: 'https://facebook.com/yardhouse', confidence: 95, source: 'extracted', evidence: [] },
    ],
  },
  marketing: {
    elements: [
      { type: 'cta', content: 'Find a Location', url: 'https://yardhouse.com/locations', confidence: 95, source: 'extracted', evidence: [] },
      { type: 'cta', content: 'View Menu', url: 'https://yardhouse.com/menu', confidence: 92, source: 'extracted', evidence: [] },
      { type: 'cta', content: 'Order Online', url: 'https://yardhouse.com/order', confidence: 90, source: 'extracted', evidence: [] },
    ],
    ctaPatterns: ['Find a Location', 'View Menu', 'Order Now', 'Join the Waitlist'],
    newsletterSignupLanguage: ['Get exclusive offers and beer news'],
  },
  tone: {
    traits: ['Bold', 'Inviting', 'Enthusiastic', 'Social', 'Craft-focused'],
    doList: ['Emphasize the extensive beer selection', 'Use inviting, social language', 'Highlight the experience, not just food'],
    dontList: ['Sound pretentious about beer', 'Be too formal', 'Ignore the social atmosphere'],
    sampleHeadlines: ['100+ Taps. Endless Possibilities.', 'Where Great Beer Meets Great Food', 'Your Table is Ready'],
    sampleCtas: ['Find a Location', 'Explore the Menu', 'Join Us'],
    styleNotes: ['Headlines emphasize scale and variety', 'Warm, inviting imagery', 'Focus on communal dining experience'],
    confidence: 88,
    source: 'inferred',
    evidence: [],
  },
  consistency: {
    score: 85,
    grade: 'B',
    breakdown: { color: 22, typography: 18, tone: 20, seo: 13, message: 12 },
    issues: ['Some older location pages need visual refresh', 'Menu page typography could be more consistent'],
  },
  generatedAssets: {
    linkedinPost: "100+ beers on tap. Classic American favorites. One unforgettable experience.\n\nAt Yard House, we believe great food deserves great beer. Come discover your new favorite.\n\n#YardHouse #CraftBeer #GoodTimes",
    instagramPost: "That moment when you realize there's 100+ beers to choose from.\n\nNo wrong answers here.\n\n#YardHouse #BeerLover #CraftBeer #TapTakeover",
    twitterPost: "Life's too short for boring beer.\n\nFind your new favorite at Yard House.\n\n#100Taps",
    adHeadlines: ['100+ Taps. One Destination.', 'Great Beer. Great Food. Great Times.'],
    emailSubjects: ['New seasonal taps just arrived', 'Your table is waiting'],
    elevatorPitch: 'Yard House is America\'s premier beer destination, offering 100+ draft beers alongside classic American cuisine in a lively, social atmosphere.',
    ctaVariations: ['Find a Location', 'View Our Taps', 'Reserve a Table'],
    generatedAt: new Date().toISOString(),
  },
  aiInsights: {
    executiveSummary: 'Yard House maintains strong brand consistency with a B grade (85/100). The brand effectively communicates its unique value proposition of extensive beer selection paired with quality American food.\n\nThe visual identity is bold and inviting, with the signature red creating strong brand recognition. The tone consistently emphasizes the social, communal dining experience.',
    actionItems: [
      'Refresh older location pages to match current brand standards',
      'Standardize menu page typography for better consistency',
      'Add more structured data for beer selection to improve local SEO',
    ],
    scoreExplanation: 'The 85/100 score reflects solid brand execution with minor inconsistencies. Typography variations (-2 points) and some outdated location pages (-3 points) prevent a higher score.',
    competitorPositioning: 'In the casual dining segment, Yard House differentiates through its unmatched beer selection. Competitors like BJ\'s and Buffalo Wild Wings can\'t match the 100+ tap offering.',
    generatedAt: new Date().toISOString(),
  },
  crawlStats: { pagesProcessed: 18, duration: 10.5, errors: [] },
  generatedAt: new Date().toISOString(),
  cached: false,
}

// Export all mock brands
export const MOCK_BRANDS: MockBrand[] = [
  {
    domains: ['nike.com', 'www.nike.com'],
    report: nikeMockReport,
  },
  {
    domains: ['sushieatstation.com', 'www.sushieatstation.com', 'sushi'],
    report: sushiMockReport,
  },
  {
    domains: ['yardhouse.com', 'www.yardhouse.com', 'yard-house', 'yardhouse'],
    report: yardHouseMockReport,
  },
]

/**
 * Get mock report for a domain
 * Returns null if no mock data exists for this domain
 */
export function getMockReport(domain: string): BrandReport | null {
  // Normalize the domain - remove www, protocol, trailing slashes
  const normalizedDomain = domain
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim()

  for (const brand of MOCK_BRANDS) {
    for (const d of brand.domains) {
      const normalizedMockDomain = d.toLowerCase().replace(/^www\./, '')

      // Check for exact match or if domain contains the mock domain
      if (normalizedMockDomain === normalizedDomain ||
          normalizedDomain.includes(normalizedMockDomain) ||
          normalizedMockDomain.includes(normalizedDomain)) {
        // Return a copy with fresh timestamps
        return {
          ...brand.report,
          id: `mock-${Date.now()}`,
          generatedAt: new Date().toISOString(),
          cached: true,
        }
      }
    }
  }

  return null
}

/**
 * Check if mock mode is enabled
 */
export function isMockModeEnabled(): boolean {
  return process.env.NODE_ENV === 'development' &&
         process.env.USE_MOCK_DATA === 'true'
}

/**
 * Get all available mock domains for the dev UI
 */
export function getAvailableMockDomains(): string[] {
  return MOCK_BRANDS.map(b => b.domains[0])
}
