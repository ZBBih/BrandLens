/**
 * Tooltip explanations for technical terms
 * Written for small business owners, not developers
 */

export interface TooltipData {
  title: string
  description: string
  learnMore?: string
}

export const tooltips: Record<string, TooltipData> = {
  // Colors
  primaryColor: {
    title: "Primary Brand Color",
    description: "This is the color used most prominently across your site — typically in your logo, buttons, and headers. It's the color people associate with your brand.",
  },
  secondaryColor: {
    title: "Secondary Brand Color",
    description: "This supports your primary color and is often used for backgrounds, borders, or less prominent elements. It creates visual variety while staying on-brand.",
  },
  accentColor: {
    title: "Accent Color",
    description: "A pop of color used sparingly to draw attention to important elements like call-to-action buttons or special offers.",
  },

  // Typography
  primaryFont: {
    title: "Primary Font",
    description: "The main font used for body text throughout your website. It should be easy to read and reflect your brand's personality.",
  },
  headingFont: {
    title: "Heading Font",
    description: "The font used for titles and headlines. Often bolder or more distinctive than body text to grab attention.",
  },
  googleFonts: {
    title: "Google Fonts",
    description: "A free library of fonts that websites can use. If your site uses Google Fonts, they'll load consistently for all visitors.",
    learnMore: "https://fonts.google.com",
  },

  // SEO
  schema: {
    title: "What is Schema?",
    description: "Schema markup tells search engines what type of business you are. Having 'LocalBusiness' or 'Organization' helps you appear in Google searches with rich results.",
    learnMore: "https://developers.google.com/search/docs/advanced/structured-data",
  },
  openGraph: {
    title: "What is OpenGraph?",
    description: "OpenGraph tags control how your site looks when shared on Facebook, LinkedIn, and other social platforms. They set the title, image, and description in the preview.",
    learnMore: "https://ogp.me",
  },
  h1Pattern: {
    title: "What is an H1?",
    description: "The H1 is the main headline on each page. Search engines use it to understand what the page is about. Consistent H1 patterns help with SEO.",
  },
  metaDescription: {
    title: "Meta Description",
    description: "The short text that appears under your page title in Google search results. Good descriptions increase click-through rates from search.",
  },
  titleTag: {
    title: "Title Tag",
    description: "The text that appears in browser tabs and search results. A good title tag includes your brand name and what the page is about.",
  },
  canonicalTag: {
    title: "Canonical Tag",
    description: "Tells search engines which version of a page is the 'main' one. Prevents duplicate content issues if you have similar pages.",
  },

  // Tone & Voice
  toneTraits: {
    title: "Tone Traits",
    description: "These describe HOW your brand communicates. 'Professional' means formal language, 'Conversational' means casual and friendly. Your tone should match your audience.",
  },
  toneDoList: {
    title: "Brand Voice Do's",
    description: "Writing guidelines that capture your brand's personality. Following these ensures consistent communication across all content.",
  },
  toneDontList: {
    title: "Brand Voice Don'ts",
    description: "Things to avoid in your communications. These help prevent off-brand messaging that could confuse your audience.",
  },

  // Consistency Score
  consistencyScore: {
    title: "Brand Consistency Score",
    description: "This measures how uniform your brand appears across your entire website. Higher scores mean colors, fonts, and messaging are consistent on every page.",
  },
  colorConsistency: {
    title: "Color Consistency",
    description: "How consistently your brand colors are used across all pages. Off-brand colors on some pages will lower this score.",
  },
  typographyConsistency: {
    title: "Typography Consistency",
    description: "Whether the same fonts are used on every page. Random font switches make your brand look unprofessional.",
  },
  toneConsistency: {
    title: "Tone Consistency",
    description: "Whether your writing style stays consistent. If your homepage is formal but your blog is casual, this score drops.",
  },
  seoConsistency: {
    title: "SEO Consistency",
    description: "Whether your title tags, meta descriptions, and H1s follow consistent patterns. Helps search engines understand your site structure.",
  },
  messageConsistency: {
    title: "Message Consistency",
    description: "How well your key messages and taglines are reinforced across different pages. Repetition builds brand recognition.",
  },

  // Social
  socialLinks: {
    title: "Brand Channels",
    description: "Links to your social media profiles found on your website. These help customers connect with you on platforms they use.",
  },

  // Local/GEO
  localPresence: {
    title: "Local Presence",
    description: "Physical address and phone number information found on your site. Important for local SEO and building trust.",
  },
  napData: {
    title: "NAP Data",
    description: "Name, Address, Phone — the core info Google uses for local search. Consistent NAP across the web improves local rankings.",
  },

  // Generated Assets
  generatedAssets: {
    title: "AI-Generated Copy",
    description: "Marketing content created by AI based on your brand's tone and messaging. Use these as starting points, then customize for your needs.",
  },
  elevatorPitch: {
    title: "Elevator Pitch",
    description: "A single sentence that captures what you do and why it matters. Perfect for introducing your business in any context.",
  },

  // Report
  confidence: {
    title: "Confidence Score",
    description: "How certain we are about this finding. Higher scores mean the data was clearly found on your site. Lower scores may need manual verification.",
  },
  evidence: {
    title: "Evidence",
    description: "The specific pages and code where we found this information. Click to see exactly where the data came from.",
  },
}

/**
 * Get tooltip data by key
 */
export function getTooltip(key: string): TooltipData | null {
  return tooltips[key] || null
}
