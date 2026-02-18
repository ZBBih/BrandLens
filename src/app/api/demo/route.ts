/**
 * GET /api/demo
 * Returns the demo report for instant preview (no database required)
 */

import { NextResponse } from 'next/server'

const DEMO_ID = 'demo-nike-report'
const DEMO_SLUG = 'demo-nike-brand'

// Inline demo data to avoid any import issues
const DEMO_REPORT = {
  domain: 'nike.com',
  brandName: 'Nike',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Logo_NIKE.svg/200px-Logo_NIKE.svg.png',
  summary: {
    name: 'Nike',
    description: 'Nike, Inc. is the world\'s largest supplier of athletic shoes and apparel and a major manufacturer of sports equipment. Founded in 1964 as Blue Ribbon Sports, Nike has grown into a global brand synonymous with athletic excellence, innovation, and the iconic "Just Do It" slogan.',
    valueProposition: 'Bring inspiration and innovation to every athlete in the world',
    targetAudience: 'Athletes of all levels, fitness enthusiasts, sports fans, and lifestyle consumers seeking premium athletic wear and footwear',
    industry: 'Athletic Apparel & Footwear / Sportswear',
    confidence: 98,
    source: 'extracted',
    evidence: [
      { url: 'https://nike.com/', snippet: 'Just Do It. Nike.com', context: 'hero section' },
      { url: 'https://nike.com/about', snippet: 'Our mission is to bring inspiration and innovation...', context: 'about page intro' },
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
        evidence: [
          { url: 'https://nike.com/', snippet: "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif", context: 'body CSS' },
        ],
      },
      {
        name: 'Nike Futura',
        role: 'heading',
        variants: ['700', '800', '900'],
        confidence: 94,
        source: 'extracted',
        evidence: [
          { url: 'https://nike.com/', snippet: "font-family: 'Nike Futura', 'Futura', sans-serif", context: 'headline CSS' },
        ],
      },
    ],
    googleFontsDetected: false,
  },
  colors: {
    colors: [
      {
        hex: '#111111',
        rgb: { r: 17, g: 17, b: 17 },
        role: 'primary',
        cssVariable: '--nike-black',
        confidence: 98,
        source: 'extracted',
        evidence: [
          { url: 'https://nike.com/', snippet: '--nike-black: #111111', context: 'CSS variables' },
          { url: 'https://nike.com/', snippet: 'background-color: #111111', context: 'header, footer' },
        ],
      },
      {
        hex: '#FFFFFF',
        rgb: { r: 255, g: 255, b: 255 },
        role: 'background',
        cssVariable: '--nike-white',
        confidence: 97,
        source: 'extracted',
        evidence: [
          { url: 'https://nike.com/', snippet: '--nike-white: #FFFFFF', context: 'CSS variables' },
        ],
      },
      {
        hex: '#FA5400',
        rgb: { r: 250, g: 84, b: 0 },
        role: 'accent',
        cssVariable: '--nike-orange',
        confidence: 92,
        source: 'extracted',
        evidence: [
          { url: 'https://nike.com/sale', snippet: 'color: #FA5400', context: 'sale badges' },
        ],
      },
      {
        hex: '#7E7E7E',
        rgb: { r: 126, g: 126, b: 126 },
        role: 'secondary',
        cssVariable: '--nike-grey',
        confidence: 90,
        source: 'extracted',
        evidence: [
          { url: 'https://nike.com/', snippet: 'color: #7E7E7E', context: 'secondary text' },
        ],
      },
      {
        hex: '#F5F5F5',
        rgb: { r: 245, g: 245, b: 245 },
        role: 'background',
        confidence: 88,
        source: 'extracted',
        evidence: [
          { url: 'https://nike.com/', snippet: 'background-color: #F5F5F5', context: 'card backgrounds' },
        ],
      },
    ],
  },
  seo: {
    score: 10,
    wins: [
      {
        type: 'title',
        status: 'good',
        headline: 'Strong brand presence in titles',
        detail: 'All page titles include "Nike" and use the pattern: "[Product/Category]. Nike.com". This reinforces brand recognition in search results.',
      },
      {
        type: 'title',
        status: 'good',
        headline: 'Optimal title length',
        detail: 'Average title length is 48 characters, fitting perfectly in search result displays.',
      },
      {
        type: 'description',
        status: 'good',
        headline: 'All pages have compelling meta descriptions',
        detail: 'Every page has action-oriented meta descriptions that drive clicks.',
      },
      {
        type: 'h1',
        status: 'good',
        headline: 'Clear page hierarchies',
        detail: 'Each page has a single, descriptive H1 that matches user intent.',
      },
      {
        type: 'schema',
        status: 'good',
        headline: 'Rich product schema implemented',
        detail: 'Products display with prices, ratings, and availability in Google search results.',
      },
      {
        type: 'canonical',
        status: 'good',
        headline: 'Canonical URLs properly configured',
        detail: 'Prevents duplicate content issues across regional and category pages.',
      },
      {
        type: 'og',
        status: 'good',
        headline: 'Optimized social sharing',
        detail: 'High-quality images and compelling descriptions for social media sharing.',
      },
    ],
    issues: [],
    googlePreview: {
      title: 'Nike. Just Do It. Nike.com',
      url: 'https://nike.com/',
      description: 'Shop the latest Nike shoes, clothing, and gear. Free delivery and returns on select orders. Join Nike Membership for exclusive products and benefits.',
    },
    socialPreview: {
      title: 'Nike. Just Do It. Nike.com',
      description: 'Inspiring the world\'s athletes. Shop the latest innovation in shoes, clothing, and gear.',
      image: 'https://static.nike.com/a/images/f_auto/dpr_1.0/h_600,c_limit/og-default.jpg',
      siteName: 'Nike',
    },
    titlePattern: '[Product/Category]. Nike.com',
    titlePatterns: [
      'Nike [Product Name] | Nike.com',
      '[Category] Shoes & Sneakers. Nike.com',
    ],
    descriptionPatterns: [
      'Shop Nike [Category] for the latest...',
      'Discover the Nike [Product] featuring...',
    ],
    h1Patterns: [
      'Men\'s Shoes',
      'Women\'s Clothing',
      'New Releases',
    ],
    hasCanonical: true,
    schemaTypes: ['Organization', 'WebSite', 'Product', 'BreadcrumbList'],
    schemas: [],
    confidence: 96,
    source: 'extracted',
    evidence: [
      { url: 'https://nike.com/', snippet: '<title>Nike. Just Do It. Nike.com</title>', context: 'head' },
    ],
  },
  geo: {
    addresses: ['One Bowerman Drive, Beaverton, OR 97005'],
    phoneNumbers: ['1-800-806-6453'],
    hasGoogleMaps: true,
    hasLocalBusinessSchema: true,
    locationPages: ['/retail', '/stores'],
    confidence: 94,
    source: 'extracted',
    evidence: [
      { url: 'https://nike.com/help/contact', snippet: 'One Bowerman Drive, Beaverton, Oregon', context: 'contact page' },
    ],
  },
  social: {
    links: [
      {
        platform: 'instagram',
        url: 'https://instagram.com/nike',
        handle: '@nike',
        confidence: 98,
        source: 'extracted',
        evidence: [{ url: 'https://nike.com/', snippet: 'instagram.com/nike', context: 'footer' }],
      },
      {
        platform: 'twitter',
        url: 'https://twitter.com/nike',
        handle: '@nike',
        confidence: 98,
        source: 'extracted',
        evidence: [{ url: 'https://nike.com/', snippet: 'twitter.com/nike', context: 'footer' }],
      },
      {
        platform: 'facebook',
        url: 'https://facebook.com/nike',
        confidence: 98,
        source: 'extracted',
        evidence: [{ url: 'https://nike.com/', snippet: 'facebook.com/nike', context: 'footer' }],
      },
      {
        platform: 'youtube',
        url: 'https://youtube.com/nike',
        confidence: 98,
        source: 'extracted',
        evidence: [{ url: 'https://nike.com/', snippet: 'youtube.com/nike', context: 'footer' }],
      },
    ],
  },
  marketing: {
    elements: [
      {
        type: 'cta',
        content: 'Just Do It.',
        url: 'https://nike.com/',
        confidence: 100,
        source: 'extracted',
        evidence: [],
      },
      {
        type: 'cta',
        content: 'Shop Now',
        url: 'https://nike.com/',
        confidence: 96,
        source: 'extracted',
        evidence: [],
      },
      {
        type: 'cta',
        content: 'Join Us',
        url: 'https://nike.com/membership',
        confidence: 94,
        source: 'extracted',
        evidence: [],
      },
    ],
    ctaPatterns: ['Shop Now', 'Shop', 'Join Us', 'Find Your Store', 'Customize'],
    newsletterSignupLanguage: ['Be the first to know about new releases, special offers, and more'],
  },
  tone: {
    traits: ['Bold', 'Empowering', 'Aspirational', 'Athletic', 'Confident'],
    doList: [
      'Use short, punchy sentences that inspire action',
      'Speak directly to the athlete in everyone',
      'Lead with benefits and emotional connection',
      'Use active, powerful verbs',
      'Keep messaging inclusive - "If you have a body, you are an athlete"',
    ],
    dontList: [
      'Use passive or weak language',
      'Over-explain or be verbose',
      'Sound corporate or detached',
      'Focus solely on product features without emotional connection',
      'Exclude any level of athlete',
    ],
    sampleHeadlines: [
      'Just Do It.',
      'Find Your Greatness',
      'There Is No Finish Line',
      'Play New',
    ],
    sampleCtas: [
      'Shop Now',
      'Find Your Store',
      'Join Nike Membership',
      'Customize Your Shoe',
    ],
    styleNotes: [
      'Headlines are bold, often sentence fragments',
      'Product copy is concise and benefit-focused',
      'Athlete stories drive emotional connection',
      'Photography and video are as important as copy',
    ],
    confidence: 95,
    source: 'inferred',
    evidence: [
      { url: 'https://nike.com/', snippet: 'Just Do It', context: 'tagline throughout' },
      { url: 'https://nike.com/about', snippet: 'If you have a body, you are an athlete', context: 'brand philosophy' },
    ],
  },
  consistency: {
    score: 95,
    grade: 'A',
    breakdown: {
      color: 24,
      typography: 20,
      tone: 24,
      seo: 14,
      message: 13,
    },
    issues: [
      'Some regional sites have slight color variations for local campaigns',
      'Legacy product pages occasionally use older typography',
    ],
  },
  generatedAssets: {
    linkedinPost: "Every champion was once a contender who refused to give up.\n\nAt Nike, we believe greatness isn't reserved for the few. It's for anyone willing to put in the work.\n\nOur athletes don't just wear our gear—they push the boundaries of what's possible.\n\nWhat's your next finish line? \n\n#JustDoIt #Nike #AthletesMindset",
    instagramPost: "Greatness is earned, never given.\n\nEvery early morning. Every extra rep. Every time you push past \"I can't.\"\n\nThat's where champions are made.\n\nTag someone who inspires you to go harder.\n\n#JustDoIt #NikeRunning",
    twitterPost: "You don't need permission to be great.\n\nYou just need to start.\n\n#JustDoIt",
    adHeadlines: [
      'Just Do It. Find Your Greatness.',
      'New Arrivals. Unlimited Potential.',
      'Run Faster. Train Harder. Be Legendary.',
      'Your Next Personal Best Starts Here.',
    ],
    emailSubjects: [
      'Your exclusive early access is here',
      'New drops just landed',
      'Built for your next PR',
      'Member exclusive: 48 hours only',
    ],
    elevatorPitch: 'Nike is the world\'s leading athletic brand, bringing inspiration and innovation to every athlete in the world. From groundbreaking footwear technology to sustainable manufacturing, we\'re committed to helping athletes at every level achieve their potential.',
    ctaVariations: [
      'Shop Now',
      'Find Your Fit',
      'Join Nike Membership',
      'Customize Yours',
      'Explore the Collection',
    ],
    generatedAt: '2024-01-15T12:00:00.000Z',
  },
  aiInsights: {
    executiveSummary: `Nike demonstrates exceptional brand consistency across all digital touchpoints, earning an A grade (95/100). The brand's visual identity is immediately recognizable through its bold use of black and white with strategic orange accents, paired with clean Helvetica Neue typography.

The "Just Do It" messaging permeates every customer touchpoint, from product pages to email campaigns. Nike's tone is consistently empowering and action-oriented, speaking directly to the athlete in everyone. Their SEO foundation is rock-solid, with proper schema markup enabling rich search results for products.

Key strengths include world-class social media presence across all major platforms, a seamless omnichannel experience, and compelling athlete-driven storytelling that reinforces brand values.`,
    actionItems: [
      'Continue leveraging athlete partnerships for authentic storytelling across social channels',
      'Expand accessibility features to reinforce the inclusive "If you have a body, you are an athlete" message',
      'Consider adding more localized content to regional sites while maintaining global brand consistency',
      'Implement video schema markup on product pages to capture video search results',
      'A/B test CTA variations beyond "Shop Now" to optimize conversion rates',
    ],
    scoreExplanation: `Nike's 95/100 consistency score reflects near-perfect brand execution. The 5-point deduction comes from minor variations in regional sites during local campaigns and some legacy product pages using older typography styles. These are minor issues that don't significantly impact overall brand perception. The score breakdown shows excellence across all categories: Color (24/25), Typography (20/20), Tone (24/25), SEO (14/15), and Message Consistency (13/15).`,
    competitorPositioning: `In the athletic apparel space, Nike leads competitors like Adidas, Under Armour, and Puma in brand consistency and digital presence. While Adidas has made gains with their "Impossible Is Nothing" campaign, Nike's "Just Do It" remains more universally recognized. Nike's advantage lies in their storytelling approach—focusing on athlete journeys rather than just product features. Their membership program and SNKRS app create exclusive experiences that competitors struggle to match.`,
    generatedAt: '2024-01-15T12:00:00.000Z',
  },
  crawlStats: {
    pagesProcessed: 25,
    duration: 12.4,
    errors: [],
  },
  generatedAt: '2024-01-15T12:00:00.000Z',
  cached: false,
  isPublic: true,
}

export async function GET() {
  try {
    const report = {
      ...DEMO_REPORT,
      id: DEMO_ID,
      slug: DEMO_SLUG,
    }

    return NextResponse.json({
      success: true,
      reportId: DEMO_ID,
      slug: DEMO_SLUG,
      report,
    })
  } catch (error) {
    console.error('Demo report error:', error)
    return NextResponse.json(
      { error: 'Failed to load demo report' },
      { status: 500 }
    )
  }
}
