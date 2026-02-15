/**
 * AI-Generated Marketing Assets
 * Uses Claude API to generate ready-to-use marketing copy
 */

import Anthropic from '@anthropic-ai/sdk'
import { GeneratedAssets, BrandSummary, ToneData, MarketingData } from '../extractors/types'

const MODEL = 'claude-sonnet-4-20250514'

/**
 * Check if Claude API is configured
 */
function isClaudeConfigured(): boolean {
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
 * Generate marketing assets using Claude API
 */
export async function generateMarketingAssets(
  domain: string,
  brandName: string,
  summary: BrandSummary,
  tone: ToneData,
  marketing: MarketingData
): Promise<GeneratedAssets | null> {
  if (!isClaudeConfigured()) {
    console.log('Claude API not configured, skipping asset generation')
    return null
  }

  const existingCtas = marketing.ctaPatterns.slice(0, 5).join(', ') || 'Not found'
  const keyMessages = marketing.elements
    .filter(e => e.type === 'testimonial' || e.type === 'cta')
    .slice(0, 3)
    .map(e => e.content)
    .join('; ') || 'Not found'

  const socialProof = marketing.elements
    .filter(e => e.type === 'testimonial' || e.type === 'trust_badge' || e.type === 'client_logo')
    .slice(0, 3)
    .map(e => e.content)
    .join('; ') || 'None found'

  const prompt = `You are a marketing copywriter. Based on this brand analysis, generate marketing assets that match their exact voice and style.

BRAND CONTEXT:
- Company: ${brandName} (${domain})
- Summary: ${summary.description}
- Value Proposition: ${summary.valueProposition || 'Not specified'}
- Target Audience: ${summary.targetAudience || 'Not specified'}
- Industry: ${summary.industry || 'Not specified'}
- Tone traits: ${tone.traits.join(', ')}
- Do's: ${tone.doList.slice(0, 3).join('; ')}
- Don'ts: ${tone.dontList.slice(0, 3).join('; ')}
- Sample CTAs from site: ${existingCtas}
- Key messages found: ${keyMessages}
- Social proof: ${socialProof}

Generate marketing assets in JSON format. Match their tone EXACTLY - if they're formal, be formal. If they're playful, be playful. Use their language patterns.

Respond with ONLY a JSON object in this exact format:
{
  "linkedinPost": "Professional LinkedIn post about their value proposition (150-200 words). Include relevant hashtags.",
  "instagramPost": "Casual Instagram caption with appropriate emojis based on their tone (80-100 words). Include hashtags.",
  "twitterPost": "Punchy tweet that captures their essence (max 280 characters)",
  "adHeadlines": [
    "Question-style headline",
    "Benefit-focused headline",
    "Urgency headline",
    "Social proof headline",
    "Statement headline"
  ],
  "emailSubjects": [
    "Curiosity-driven subject (under 50 chars)",
    "Benefit subject (under 50 chars)",
    "Urgency subject (under 50 chars)",
    "Personal subject (under 50 chars)",
    "Direct subject (under 50 chars)"
  ],
  "elevatorPitch": "Single sentence: We help [audience] [achieve outcome] so they can [benefit]",
  "ctaVariations": [
    "Primary CTA button text",
    "Alternative CTA 1",
    "Alternative CTA 2",
    "Alternative CTA 3",
    "Alternative CTA 4"
  ]
}

Requirements:
- LinkedIn: Professional but matching their voice, include 3-5 relevant hashtags
- Instagram: Match the casualness level of their brand, emojis only if their brand uses them
- Twitter: Punchy and memorable, can include 1-2 hashtags
- Ad Headlines: 5-8 words each, varied styles
- Email Subjects: Under 50 characters each, create curiosity
- Elevator Pitch: Clear and compelling one-liner
- CTAs: Action-oriented, 2-4 words each

Be specific to their industry and value proposition. Don't be generic.`

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

    // Parse JSON from response
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in response')
    }

    const parsed = JSON.parse(jsonMatch[0])

    return {
      linkedinPost: parsed.linkedinPost || '',
      instagramPost: parsed.instagramPost || '',
      twitterPost: parsed.twitterPost || '',
      adHeadlines: parsed.adHeadlines || [],
      emailSubjects: parsed.emailSubjects || [],
      elevatorPitch: parsed.elevatorPitch || '',
      ctaVariations: parsed.ctaVariations || [],
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    console.error('Asset generation error:', error)
    return null
  }
}
