/**
 * Tone and voice analysis using Claude API
 */

import Anthropic from '@anthropic-ai/sdk'
import { PageData } from '../crawler'
import { ToneData, BrandSummary, Evidence, AIInsights, BrandReport } from '../extractors/types'

const MODEL = 'claude-sonnet-4-20250514'

/**
 * Check if Claude API is configured
 */
export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

/**
 * Get Anthropic client
 */
function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })
}

/**
 * Extract relevant content for analysis
 */
function extractContentForAnalysis(pages: PageData[]): {
  heroText: string[]
  aboutText: string[]
  ctaText: string[]
  headings: string[]
  pageUrls: string[]
} {
  const heroText: string[] = []
  const aboutText: string[] = []
  const ctaText: string[] = []
  const headings: string[] = []
  const pageUrls: string[] = []

  for (const page of pages) {
    pageUrls.push(page.url)

    // Extract H1s as hero text
    const h1s = page.headings.filter(h => h.level === 1)
    heroText.push(...h1s.map(h => h.text).slice(0, 3))

    // All headings for context
    headings.push(...page.headings.map(h => h.text).slice(0, 5))

    // Check if it's an about page
    if (/about|company|story|mission|values/i.test(page.url)) {
      // Get description and some headings
      if (page.description) {
        aboutText.push(page.description)
      }
      aboutText.push(...h1s.map(h => h.text))
    }

    // Get CTA text
    ctaText.push(...page.ctaButtons.slice(0, 5))
  }

  return {
    heroText: [...new Set(heroText)].slice(0, 10),
    aboutText: [...new Set(aboutText)].slice(0, 10),
    ctaText: [...new Set(ctaText)].slice(0, 15),
    headings: [...new Set(headings)].slice(0, 20),
    pageUrls: pageUrls.slice(0, 10),
  }
}

/**
 * Analyze tone and voice using Claude
 */
export async function analyzeToneVoice(pages: PageData[]): Promise<ToneData> {
  if (!isClaudeConfigured()) {
    return createFallbackToneData(pages)
  }

  const content = extractContentForAnalysis(pages)
  const evidence: Evidence[] = []

  // Build evidence from content
  for (let i = 0; i < Math.min(content.heroText.length, 5); i++) {
    evidence.push({
      url: content.pageUrls[0] || 'homepage',
      snippet: content.heroText[i],
      context: 'Hero text',
    })
  }

  const prompt = `You are a brand strategist analyzing a company's voice and tone. Based on the website content below, provide a HIGHLY SPECIFIC analysis that captures what makes THIS brand unique.

HERO TEXT / MAIN HEADLINES:
${content.heroText.join('\n')}

ABOUT/COMPANY PAGE CONTENT:
${content.aboutText.join('\n')}

CTA BUTTONS:
${content.ctaText.join('\n')}

OTHER HEADINGS:
${content.headings.join('\n')}

Respond with ONLY a JSON object in this exact format:
{
  "traits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
  "doList": ["Do write like this...", "Do use phrases like...", "Do maintain..."],
  "dontList": ["Don't use jargon like...", "Don't be overly...", "Don't use..."],
  "sampleHeadlines": ["Sample headline 1", "Sample headline 2", "Sample headline 3"],
  "sampleCtas": ["Sample CTA 1", "Sample CTA 2", "Sample CTA 3"],
  "styleNotes": ["Note about writing style 1", "Note about writing style 2"]
}

CRITICAL REQUIREMENTS - BE SPECIFIC, NOT GENERIC:

1. traits (5-7 descriptors):
   - AVOID generic words like "Professional", "Clear", "Direct", "Simple", "Conversational" - these apply to everyone
   - INSTEAD use industry-specific or emotionally-resonant traits like:
     * For a lawyer: "Reassuring", "Urgency-driven", "Results-focused", "Authoritative"
     * For a SaaS: "Developer-friendly", "No-nonsense", "Growth-obsessed"
     * For a fashion brand: "Aspirational", "Trend-setting", "Inclusive"
   - Base traits on the ACTUAL emotional triggers and value propositions in their content

2. doList (3-5 items):
   - Be SPECIFIC with examples from their actual content
   - Reference specific phrases, sentence structures, or tactics they use
   - Example: "Lead with results (they mention '5-star reviews', 'keep your license')"
   - Example: "Create urgency around deadlines ('before your court date', 'act now')"

3. dontList (3-5 items):
   - Be SPECIFIC about what would violate their brand
   - Example: "Don't use legal jargon that scares clients (they keep it accessible)"
   - Example: "Don't be passive - they always use action verbs"

4. sampleHeadlines: 3 NEW headlines matching their exact style (sentence length, punctuation, word choice)

5. sampleCtas: 3 NEW CTAs matching their button style (length, verb choice, urgency level)

6. styleNotes: 2-3 SPECIFIC observations about sentence length, use of numbers/stats, punctuation style, reading level

Your analysis should be so specific that someone could NOT use it for a different company in a different industry.`

  try {
    const client = getClient()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    // Extract text from response
    const textBlock = response.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    // Parse JSON from response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      traits: parsed.traits || [],
      doList: parsed.doList || [],
      dontList: parsed.dontList || [],
      sampleHeadlines: parsed.sampleHeadlines || [],
      sampleCtas: parsed.sampleCtas || [],
      styleNotes: parsed.styleNotes || [],
      confidence: 85,
      source: 'inferred',
      evidence,
    }
  } catch (error) {
    console.error('Claude API error:', error)
    return createFallbackToneData(pages)
  }
}

/**
 * Generate brand summary using Claude
 */
export async function generateBrandSummary(
  pages: PageData[],
  brandName: string,
  existingDescription?: string
): Promise<BrandSummary> {
  if (!isClaudeConfigured()) {
    return createFallbackSummary(pages, brandName, existingDescription)
  }

  const content = extractContentForAnalysis(pages)
  const evidence: Evidence[] = []

  // Collect descriptions
  const descriptions: string[] = []
  for (const page of pages) {
    if (page.description) {
      descriptions.push(page.description)
    }
    if (page.ogData['description']) {
      descriptions.push(page.ogData['description'])
    }
  }

  if (existingDescription) {
    descriptions.unshift(existingDescription)
  }

  const prompt = `Analyze this brand and provide a concise summary. Respond with ONLY a JSON object.

BRAND NAME: ${brandName}

EXISTING DESCRIPTIONS:
${descriptions.slice(0, 5).join('\n')}

HERO TEXT / MAIN HEADLINES:
${content.heroText.join('\n')}

ABOUT/COMPANY PAGE CONTENT:
${content.aboutText.join('\n')}

OTHER HEADINGS:
${content.headings.join('\n')}

Respond with ONLY a JSON object in this exact format:
{
  "description": "A 2-3 sentence summary of what this brand/company does and its value proposition",
  "missionStatement": "Their mission if explicitly stated, or null if not found",
  "valueProposition": "Their main value proposition in one sentence",
  "targetAudience": "Who their target audience appears to be",
  "industry": "The industry or sector they operate in"
}

Be specific and grounded in the provided content. Use "Not found" for fields that cannot be determined from the content.`

  try {
    const client = getClient()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Build evidence
    if (descriptions[0]) {
      evidence.push({
        url: content.pageUrls[0] || 'homepage',
        snippet: descriptions[0].slice(0, 150),
        context: 'Meta description',
      })
    }

    return {
      name: brandName,
      description: parsed.description || existingDescription || 'Brand description not available',
      missionStatement: parsed.missionStatement !== 'Not found' ? parsed.missionStatement : undefined,
      valueProposition: parsed.valueProposition !== 'Not found' ? parsed.valueProposition : undefined,
      targetAudience: parsed.targetAudience !== 'Not found' ? parsed.targetAudience : undefined,
      industry: parsed.industry !== 'Not found' ? parsed.industry : undefined,
      confidence: 80,
      source: 'inferred',
      evidence,
    }
  } catch (error) {
    console.error('Claude API error:', error)
    return createFallbackSummary(pages, brandName, existingDescription)
  }
}

/**
 * Create fallback tone data when Claude is not available
 */
function createFallbackToneData(pages: PageData[]): ToneData {
  const content = extractContentForAnalysis(pages)
  const evidence: Evidence[] = []

  // Simple heuristic analysis
  const allText = [...content.heroText, ...content.headings, ...content.ctaText].join(' ').toLowerCase()

  const traits: string[] = []

  // Detect traits based on patterns
  if (/innovative|cutting-edge|revolutionary|future/i.test(allText)) {
    traits.push('Innovative')
  }
  if (/trusted|reliable|secure|safe/i.test(allText)) {
    traits.push('Trustworthy')
  }
  if (/simple|easy|effortless|streamlined/i.test(allText)) {
    traits.push('Simple')
  }
  if (/professional|enterprise|business/i.test(allText)) {
    traits.push('Professional')
  }
  if (/fun|exciting|adventure|play/i.test(allText)) {
    traits.push('Playful')
  }
  if (/we're|you'll|let's|!/.test(allText)) {
    traits.push('Conversational')
  }

  if (traits.length < 3) {
    traits.push('Professional', 'Clear', 'Direct')
  }

  if (content.heroText[0]) {
    evidence.push({
      url: content.pageUrls[0] || 'homepage',
      snippet: content.heroText[0],
      context: 'Hero text',
    })
  }

  return {
    traits: traits.slice(0, 7),
    doList: ['Write in a clear, direct manner', 'Maintain consistency across touchpoints'],
    dontList: ['Avoid overly complex jargon', 'Avoid inconsistent messaging'],
    sampleHeadlines: content.heroText.slice(0, 3),
    sampleCtas: content.ctaText.slice(0, 3),
    styleNotes: ['Analysis performed without LLM - limited insights'],
    confidence: 50,
    source: 'inferred',
    evidence,
  }
}

/**
 * Create fallback brand summary
 */
function createFallbackSummary(
  pages: PageData[],
  brandName: string,
  existingDescription?: string
): BrandSummary {
  const evidence: Evidence[] = []

  // Try to get description from meta tags
  let description = existingDescription || ''
  for (const page of pages) {
    if (page.description && !description) {
      description = page.description
      evidence.push({
        url: page.url,
        snippet: description.slice(0, 150),
        context: 'Meta description',
      })
      break
    }
  }

  if (!description) {
    description = `${brandName} - Brand analysis completed`
  }

  return {
    name: brandName,
    description,
    confidence: 40,
    source: existingDescription ? 'verified' : 'extracted',
    evidence,
  }
}

/**
 * Generate AI Insights (Executive Summary, Action Items, Score Explanation, Competitor Positioning)
 */
export async function generateAIInsights(report: Omit<BrandReport, 'aiInsights'>): Promise<AIInsights | null> {
  if (!isClaudeConfigured()) {
    return null
  }

  const prompt = `You are a senior brand strategist providing a comprehensive analysis for a client. Based on the brand report data below, provide strategic insights.

BRAND: ${report.brandName}
DOMAIN: ${report.domain}
INDUSTRY: ${report.summary.industry || 'Not specified'}

BRAND DESCRIPTION:
${report.summary.description}

VALUE PROPOSITION: ${report.summary.valueProposition || 'Not specified'}
TARGET AUDIENCE: ${report.summary.targetAudience || 'Not specified'}

BRAND CONSISTENCY SCORE: ${report.consistency?.score || 'N/A'}/100 (Grade: ${report.consistency?.grade || 'N/A'})
${report.consistency?.issues?.length ? `Issues: ${report.consistency.issues.join(', ')}` : ''}

SEO SCORE: ${report.seo.score}/10
SEO Wins: ${report.seo.wins.map(w => w.headline).join(', ') || 'None'}
SEO Issues: ${report.seo.issues.map(i => i.headline).join(', ') || 'None'}

VOICE & TONE TRAITS: ${report.tone.traits.join(', ')}

COLORS DETECTED: ${report.colors.colors.length}
FONTS DETECTED: ${report.typography.fonts.length}
SOCIAL CHANNELS: ${report.social.links.map(l => l.platform).join(', ') || 'None found'}

PAGES ANALYZED: ${report.crawlStats.pagesProcessed}

Respond with ONLY a JSON object in this exact format:
{
  "executiveSummary": "A 2-3 paragraph executive summary covering: 1) Overall brand strength and market positioning, 2) Key differentiators and unique value, 3) Primary areas needing attention. Be specific to THIS brand, not generic advice.",
  "actionItems": [
    "Specific, actionable recommendation 1 with expected impact",
    "Specific, actionable recommendation 2 with expected impact",
    "Specific, actionable recommendation 3 with expected impact",
    "Specific, actionable recommendation 4 with expected impact",
    "Specific, actionable recommendation 5 with expected impact"
  ],
  "scoreExplanation": "A paragraph explaining why the brand received its consistency score. Reference specific strengths that contributed positively and specific weaknesses that lowered the score. Explain what achieving a higher score would require.",
  "competitorPositioning": "A paragraph analyzing how this brand likely positions against competitors in its space. Discuss their apparent differentiation strategy, target market positioning, and where they might face competitive pressure. Include suggestions for strengthening market position."
}

REQUIREMENTS:
- Be SPECIFIC to this brand - avoid generic advice that could apply to any company
- Reference actual data from the report (colors, fonts, SEO issues, etc.)
- Action items should be prioritized by impact
- Each action item should be concrete and implementable
- Score explanation should directly tie to the consistency breakdown
- Competitor analysis should consider the brand's apparent market segment`

  try {
    const client = getClient()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    })

    const textBlock = response.content.find(block => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      executiveSummary: parsed.executiveSummary || '',
      actionItems: parsed.actionItems || [],
      scoreExplanation: parsed.scoreExplanation || '',
      competitorPositioning: parsed.competitorPositioning || '',
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Claude API error generating insights:', error)
    // Return a placeholder with the error so we can debug
    return {
      executiveSummary: `AI insights generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      actionItems: ['Check Railway logs for more details'],
      scoreExplanation: 'Unable to generate due to API error',
      competitorPositioning: 'Unable to generate due to API error',
      generatedAt: new Date().toISOString(),
    }
  }
}
