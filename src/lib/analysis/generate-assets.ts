/**
 * AI-Generated Marketing Assets
 * Uses the Claude API to generate ready-to-use marketing copy
 */

import { z } from 'zod'
import { GeneratedAssets, BrandSummary, ToneData, MarketingData } from '../extractors/types'
import { isClaudeConfigured, generateStructured, untrusted, clampList, clampText, UNTRUSTED_CONTENT_RULE } from './claude'
import { log } from '../log'

const AssetsSchema = z.object({
  linkedinPost: z.string(),
  instagramPost: z.string(),
  twitterPost: z.string(),
  adHeadlines: z.array(z.string()),
  emailSubjects: z.array(z.string()),
  elevatorPitch: z.string(),
  ctaVariations: z.array(z.string()),
})

const ASSETS_SYSTEM = `You are a marketing copywriter. Write assets that match the analyzed brand's voice exactly: formal if they are formal, playful if they are playful, using their language patterns. ${UNTRUSTED_CONTENT_RULE}

Return:
- linkedinPost: 150-200 words about their value proposition, 3-5 relevant hashtags.
- instagramPost: 80-100 words, matching the brand's casualness; emojis only if the brand's own copy would use them.
- twitterPost: at most 280 characters, 0-2 hashtags.
- adHeadlines: 5 headlines of 5-8 words (question, benefit, urgency, social proof, statement).
- emailSubjects: 5 subjects under 50 characters (curiosity, benefit, urgency, personal, direct).
- elevatorPitch: one sentence, "We help [audience] [achieve outcome] so they can [benefit]".
- ctaVariations: 5 button labels of 2-4 words, the first being the primary.
Be specific to their industry and value proposition.`

/**
 * Generate marketing assets using the Claude API.
 * Returns null when Claude is unavailable or the call fails.
 */
export async function generateMarketingAssets(
  domain: string,
  brandName: string,
  summary: BrandSummary,
  tone: ToneData,
  marketing: MarketingData,
  signal?: AbortSignal
): Promise<GeneratedAssets | null> {
  if (!isClaudeConfigured()) {
    return null
  }

  const traits = Array.isArray(tone.traits) ? tone.traits : []
  const keyMessages = marketing.elements
    .filter(e => e.type === 'testimonial' || e.type === 'cta')
    .slice(0, 3)
    .map(e => e.content)
  const socialProof = marketing.elements
    .filter(e => e.type === 'testimonial' || e.type === 'trust_badge' || e.type === 'client_logo')
    .slice(0, 3)
    .map(e => e.content)

  const prompt = [
    `Company: ${brandName.slice(0, 100)} (${domain})`,
    `Industry: ${summary.industry || 'unknown'}`,
    `Target audience: ${summary.targetAudience || 'unknown'}`,
    `Value proposition: ${summary.valueProposition || 'unknown'}`,
    untrusted('brand description', [summary.description]),
    `Voice traits: ${traits.join(', ') || 'unknown'}`,
    `Do: ${tone.doList.slice(0, 3).join('; ') || 'n/a'}`,
    `Don't: ${tone.dontList.slice(0, 3).join('; ') || 'n/a'}`,
    untrusted('calls to action on the site', marketing.ctaPatterns.slice(0, 5)),
    untrusted('key messages on the site', keyMessages),
    untrusted('social proof on the site', socialProof),
  ].join('\n\n')

  try {
    const parsed = await generateStructured({ schema: AssetsSchema, system: ASSETS_SYSTEM, prompt, effort: 'low', signal })
    return {
      linkedinPost: clampText(parsed.linkedinPost, 2000),
      instagramPost: clampText(parsed.instagramPost, 1200),
      twitterPost: clampText(parsed.twitterPost, 280),
      adHeadlines: clampList(parsed.adHeadlines, 5, 100),
      emailSubjects: clampList(parsed.emailSubjects, 5, 80),
      elevatorPitch: clampText(parsed.elevatorPitch, 300),
      ctaVariations: clampList(parsed.ctaVariations, 5, 40),
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    if (signal?.aborted) throw error
    log.error('llm.assets_failed', error)
    return null
  }
}
