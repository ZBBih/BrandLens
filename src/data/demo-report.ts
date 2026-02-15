/**
 * Pre-generated demo report data for instant preview
 * This showcases all features without requiring actual crawling
 */

import { BrandReport } from '@/lib/extractors/types'

export const DEMO_REPORT: Omit<BrandReport, 'id' | 'slug'> = {
  domain: 'acme.example.com',
  brandName: 'Acme Design Co',
  logoUrl: 'https://via.placeholder.com/200x60/3B82F6/ffffff?text=ACME',
  summary: {
    name: 'Acme Design Co',
    description: 'Acme Design Co is a boutique digital design agency specializing in brand identity, web design, and creative strategy for startups and growing businesses. With a focus on modern aesthetics and user-centered design, they help brands stand out in competitive markets.',
    valueProposition: 'Transform your brand with award-winning design that drives results',
    targetAudience: 'Tech startups, SaaS companies, and growth-stage businesses seeking premium design services',
    industry: 'Creative Services / Design Agency',
    confidence: 92,
    source: 'extracted',
    evidence: [
      { url: 'https://acme.example.com/', snippet: 'Award-winning design studio helping brands grow', context: 'hero section' },
      { url: 'https://acme.example.com/about', snippet: 'We are a boutique design agency...', context: 'about page intro' },
    ],
  },
  typography: {
    fonts: [
      {
        name: 'Inter',
        role: 'primary',
        variants: ['400', '500', '600', '700'],
        googleFontsUrl: 'https://fonts.google.com/specimen/Inter',
        confidence: 95,
        source: 'extracted',
        evidence: [
          { url: 'https://acme.example.com/', snippet: "font-family: 'Inter', sans-serif", context: 'body CSS' },
        ],
      },
      {
        name: 'Playfair Display',
        role: 'heading',
        variants: ['400', '700'],
        googleFontsUrl: 'https://fonts.google.com/specimen/Playfair+Display',
        confidence: 88,
        source: 'extracted',
        evidence: [
          { url: 'https://acme.example.com/', snippet: "font-family: 'Playfair Display'", context: 'h1, h2 CSS' },
        ],
      },
    ],
    googleFontsDetected: true,
  },
  colors: {
    colors: [
      {
        hex: '#3B82F6',
        rgb: { r: 59, g: 130, b: 246 },
        role: 'primary',
        cssVariable: '--primary',
        confidence: 96,
        source: 'extracted',
        evidence: [
          { url: 'https://acme.example.com/', snippet: '--primary: #3B82F6', context: 'CSS variables' },
          { url: 'https://acme.example.com/', snippet: 'background-color: #3B82F6', context: 'CTA button' },
        ],
      },
      {
        hex: '#1E40AF',
        rgb: { r: 30, g: 64, b: 175 },
        role: 'secondary',
        cssVariable: '--secondary',
        confidence: 91,
        source: 'extracted',
        evidence: [
          { url: 'https://acme.example.com/', snippet: '--secondary: #1E40AF', context: 'CSS variables' },
        ],
      },
      {
        hex: '#F59E0B',
        rgb: { r: 245, g: 158, b: 11 },
        role: 'accent',
        confidence: 85,
        source: 'extracted',
        evidence: [
          { url: 'https://acme.example.com/pricing', snippet: 'color: #F59E0B', context: 'highlight badge' },
        ],
      },
      {
        hex: '#0F172A',
        rgb: { r: 15, g: 23, b: 42 },
        role: 'text',
        confidence: 94,
        source: 'extracted',
        evidence: [
          { url: 'https://acme.example.com/', snippet: 'color: #0F172A', context: 'body text' },
        ],
      },
      {
        hex: '#F8FAFC',
        rgb: { r: 248, g: 250, b: 252 },
        role: 'background',
        confidence: 90,
        source: 'extracted',
        evidence: [
          { url: 'https://acme.example.com/', snippet: 'background-color: #F8FAFC', context: 'page background' },
        ],
      },
    ],
  },
  seo: {
    score: 9,
    wins: [
      {
        type: 'title',
        status: 'good',
        headline: 'Page titles are consistent',
        detail: 'Your titles follow the pattern: "[Page Name] | Acme Design Co". This helps with brand recognition in search results.',
      },
      {
        type: 'title',
        status: 'good',
        headline: 'Good title length',
        detail: 'Average title length is 52 characters, which displays well in search results.',
      },
      {
        type: 'description',
        status: 'good',
        headline: 'All 8 pages have meta descriptions',
        detail: 'Every page tells Google what it\'s about.',
      },
      {
        type: 'h1',
        status: 'good',
        headline: 'All pages have exactly one H1',
        detail: 'Each page has a clear main headline for Google (best practice).',
      },
      {
        type: 'schema',
        status: 'good',
        headline: 'Business info is structured for Google',
        detail: 'Search engines can display your business details in rich results.',
      },
      {
        type: 'canonical',
        status: 'good',
        headline: 'Canonical tags are in place',
        detail: 'Pages specify their preferred URL, preventing duplicate content issues.',
      },
      {
        type: 'og',
        status: 'good',
        headline: 'Social sharing image is set',
        detail: 'Your site will look great when shared on Facebook, LinkedIn, and Twitter.',
      },
    ],
    issues: [],
    googlePreview: {
      title: 'Acme Design Co | Award-Winning Design Agency',
      url: 'https://acme.example.com/',
      description: 'Award-winning design agency specializing in brand identity, web design, and creative strategy. Transform your brand with our expert team.',
    },
    socialPreview: {
      title: 'Acme Design Co | Award-Winning Design Agency',
      description: 'Award-winning design agency specializing in brand identity, web design, and creative strategy for startups and growing businesses.',
      image: 'https://via.placeholder.com/1200x630/3B82F6/ffffff?text=Acme+Design+Co',
      siteName: 'Acme Design Co',
    },
    titlePattern: '[Page Name] | Acme Design Co',
    titlePatterns: [
      'Acme Design Co | [Page Name]',
      '[Service] - Acme Design Co',
    ],
    descriptionPatterns: [
      'Award-winning design agency specializing in brand identity...',
    ],
    h1Patterns: [
      'Transform Your Brand',
      'Our Services',
      'About Acme Design',
    ],
    hasCanonical: true,
    schemaTypes: ['Organization', 'WebSite', 'Service'],
    schemas: [],
    confidence: 87,
    source: 'extracted',
    evidence: [
      { url: 'https://acme.example.com/', snippet: '<title>Acme Design Co | Award-Winning Design Agency</title>', context: 'head' },
    ],
  },
  geo: {
    addresses: ['123 Design Street, San Francisco, CA 94105'],
    phoneNumbers: ['+1 (555) 123-4567'],
    hasGoogleMaps: true,
    hasLocalBusinessSchema: false,
    locationPages: [],
    confidence: 82,
    source: 'extracted',
    evidence: [
      { url: 'https://acme.example.com/contact', snippet: '123 Design Street, San Francisco', context: 'contact page' },
    ],
  },
  social: {
    links: [
      {
        platform: 'instagram',
        url: 'https://instagram.com/acmedesign',
        handle: '@acmedesign',
        confidence: 95,
        source: 'extracted',
        evidence: [{ url: 'https://acme.example.com/', snippet: 'instagram.com/acmedesign', context: 'footer' }],
      },
      {
        platform: 'twitter',
        url: 'https://twitter.com/acmedesignco',
        handle: '@acmedesignco',
        confidence: 95,
        source: 'extracted',
        evidence: [{ url: 'https://acme.example.com/', snippet: 'twitter.com/acmedesignco', context: 'footer' }],
      },
      {
        platform: 'linkedin',
        url: 'https://linkedin.com/company/acme-design-co',
        confidence: 95,
        source: 'extracted',
        evidence: [{ url: 'https://acme.example.com/', snippet: 'linkedin.com/company/acme-design-co', context: 'footer' }],
      },
    ],
  },
  marketing: {
    elements: [
      {
        type: 'testimonial',
        content: '"Acme transformed our brand completely. Best investment we made." - Sarah Chen, TechCorp CEO',
        url: 'https://acme.example.com/',
        confidence: 90,
        source: 'extracted',
        evidence: [],
      },
      {
        type: 'cta',
        content: 'Start Your Project',
        url: 'https://acme.example.com/',
        confidence: 95,
        source: 'extracted',
        evidence: [],
      },
    ],
    ctaPatterns: ['Start Your Project', 'Get a Quote', 'Schedule a Call'],
    newsletterSignupLanguage: ['Join our design newsletter for weekly inspiration'],
  },
  tone: {
    traits: ['Professional', 'Creative', 'Confident', 'Approachable', 'Modern'],
    doList: [
      'Use active voice and confident statements',
      'Highlight creativity and innovation',
      'Speak directly to startup founders and decision-makers',
      'Include data and results when possible',
      'Keep sentences concise and impactful',
    ],
    dontList: [
      'Use overly technical jargon without explanation',
      'Make vague promises without backing them up',
      'Sound corporate or stuffy',
      'Use passive voice excessively',
      'Overuse buzzwords like "synergy" or "leverage"',
    ],
    sampleHeadlines: [
      'Design That Drives Growth',
      'Your Brand, Elevated',
      'Where Strategy Meets Creativity',
    ],
    sampleCtas: [
      'Let\'s Create Something Amazing',
      'Start Your Transformation',
      'Get Your Free Brand Audit',
    ],
    styleNotes: [
      'Headlines use sentence case with action verbs',
      'Body copy balances professionalism with warmth',
      'Social posts are more casual but still polished',
    ],
    confidence: 88,
    source: 'inferred',
    evidence: [
      { url: 'https://acme.example.com/', snippet: 'Design That Drives Growth', context: 'hero headline' },
      { url: 'https://acme.example.com/about', snippet: 'We believe great design...', context: 'about intro' },
    ],
  },
  consistency: {
    score: 87,
    grade: 'B',
    breakdown: {
      color: 23,
      typography: 18,
      tone: 22,
      seo: 12,
      message: 12,
    },
    issues: [
      'Minor color inconsistency on the pricing page (uses #3A82F5 instead of primary #3B82F6)',
      'Blog posts occasionally shift to a more casual tone',
      'Some older pages missing meta descriptions',
    ],
  },
  generatedAssets: {
    linkedinPost: "Great design isn't just about aesthetics—it's about driving real business results.\n\nAt Acme Design Co, we've helped 50+ startups transform their brands and achieve an average of 40% increase in conversion rates.\n\nOur secret? We don't just design pretty things. We create strategic brand experiences that connect with your audience and move them to action.\n\nReady to elevate your brand? Let's talk. 💬\n\n#BrandDesign #StartupGrowth #DesignStrategy",
    instagramPost: "Behind every successful brand is a story waiting to be told ✨\n\nSwipe to see how we helped @techstartup transform their brand identity from forgettable to unforgettable →\n\nThe result? 3x increase in brand recognition and a design system their team actually loves using.\n\nDM us 'BRAND' for a free brand audit 📩",
    twitterPost: "Hot take: Your brand doesn't need a \"rebrand.\" It needs strategic refinement.\n\nMost startups overthink their visual identity while ignoring:\n- Messaging clarity\n- User experience\n- Consistency across touchpoints\n\nFix these first, then polish the pixels.",
    adHeadlines: [
      'Transform Your Startup\'s Brand in 30 Days',
      'Design That Converts: Award-Winning Branding',
      'Stop Blending In. Start Standing Out.',
      'Brand Identity That Grows With You',
    ],
    emailSubjects: [
      'Your brand audit is ready 📊',
      'Quick question about [Company Name]\'s brand',
      'The #1 branding mistake we see startups make',
      'Case study: How we helped TechCorp grow 40%',
    ],
    elevatorPitch: 'Acme Design Co is a boutique design agency that helps tech startups and growing businesses build memorable brands that drive real results. We combine strategic thinking with modern design to create brand experiences that connect with your audience and convert.',
    ctaVariations: [
      'Get Your Free Brand Audit',
      'Schedule a Discovery Call',
      'See Our Work',
      'Let\'s Build Something Great',
      'Start Your Brand Journey',
    ],
    generatedAt: new Date().toISOString(),
  },
  crawlStats: {
    pagesProcessed: 12,
    duration: 8.3,
    errors: [],
  },
  generatedAt: new Date().toISOString(),
  cached: false,
  isPublic: true,
}
