/**
 * Tone, summary and insight analysis using an LLM (Gemini or Claude)
 */

import { z } from 'zod'
import { PageData } from '../crawler'
import { ToneData, BrandSummary, Evidence, AIInsights, BrandReport } from '../extractors/types'
import {
  isLlmConfigured,
  generateStructured,
  untrusted,
  clampList,
  clampText,
  UNTRUSTED_CONTENT_RULE,
} from './llm'
import { log } from '../log'

export { isLlmConfigured }

interface AnalysisContent {
  heroText: string[]
  aboutText: string[]
  ctaText: string[]
  headings: string[]
  pageUrls: string[]
}

/**
 * Extract relevant content for analysis
 */
function extractContentForAnalysis(pages: PageData[]): AnalysisContent {
  const heroText: string[] = []
  const aboutText: string[] = []
  const ctaText: string[] = []
  const headings: string[] = []
  const pageUrls: string[] = []

  for (const page of pages) {
    pageUrls.push(page.url)

    const h1s = page.headings.filter(h => h.level === 1)
    heroText.push(...h1s.map(h => h.text).slice(0, 3))
    headings.push(...page.headings.map(h => h.text).slice(0, 5))

    if (/about|company|story|mission|values/i.test(page.url)) {
      if (page.description) {
        aboutText.push(page.description)
      }
      aboutText.push(...h1s.map(h => h.text))
    }

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
 * Confidence in an inferred analysis grows with the amount of real copy it saw
 */
function inferredConfidence(content: AnalysisContent): number {
  const signals = content.heroText.length + content.aboutText.length + content.ctaText.length + content.headings.length
  return Math.min(90, 35 + signals * 2)
}

const ToneSchema = z.object({
  traits: z.array(z.string()),
  doList: z.array(z.string()),
  dontList: z.array(z.string()),
  sampleHeadlines: z.array(z.string()),
  sampleCtas: z.array(z.string()),
  styleNotes: z.array(z.string()),
})

const TONE_SYSTEM = `You are a brand strategist analyzing a company's voice and tone from its website copy. ${UNTRUSTED_CONTENT_RULE}

Be specific to this brand:
- traits: 5-7 descriptors. Avoid generic words that fit any company ("Professional", "Clear", "Direct", "Simple", "Conversational"); name the actual emotional triggers and positioning, e.g. "Reassuring", "Developer-friendly", "Aspirational".
- doList and dontList: 3-5 items each, citing the phrases, sentence structures or tactics the site actually uses.
- sampleHeadlines and sampleCtas: 3 new examples each, matching the site's length, punctuation, word choice and urgency.
- styleNotes: 2-3 observations about sentence length, use of numbers, punctuation and reading level.
Someone should not be able to reuse this analysis for a different company.`

/**
 * Analyze tone and voice using the LLM
 */
export async function analyzeToneVoice(pages: PageData[], signal?: AbortSignal): Promise<ToneData> {
  const content = extractContentForAnalysis(pages)
  if (!isLlmConfigured()) {
    return createFallbackToneData(content)
  }

  const evidence: Evidence[] = content.heroText.slice(0, 5).map(snippet => ({
    url: content.pageUrls[0] || 'homepage',
    snippet,
    context: 'Hero text',
  }))

  const prompt = [
    untrusted('main headlines', content.heroText),
    untrusted('about page', content.aboutText),
    untrusted('call-to-action buttons', content.ctaText),
    untrusted('other headings', content.headings),
  ].join('\n\n')

  try {
    const parsed = await generateStructured({ schema: ToneSchema, system: TONE_SYSTEM, prompt, effort: 'medium', signal })
    return {
      traits: clampList(parsed.traits, 7, 60),
      doList: clampList(parsed.doList, 5),
      dontList: clampList(parsed.dontList, 5),
      sampleHeadlines: clampList(parsed.sampleHeadlines, 3, 160),
      sampleCtas: clampList(parsed.sampleCtas, 3, 60),
      styleNotes: clampList(parsed.styleNotes, 3),
      confidence: inferredConfidence(content),
      source: 'inferred',
      evidence,
    }
  } catch (error) {
    if (signal?.aborted) throw error
    log.error('llm.tone_failed', error)
    return createFallbackToneData(content)
  }
}

const SummarySchema = z.object({
  description: z.string(),
  missionStatement: z.string().nullable(),
  valueProposition: z.string().nullable(),
  targetAudience: z.string().nullable(),
  industry: z.string().nullable(),
})

const SUMMARY_SYSTEM = `You summarize what a company does from its website. ${UNTRUSTED_CONTENT_RULE}

Return:
- description: 2-3 sentences on what the company does and its value proposition.
- missionStatement: only if the site explicitly states one, otherwise null.
- valueProposition: one sentence.
- targetAudience: who the site is written for.
- industry: the sector.
Ground every field in the provided content; use null when it cannot be determined.`

/**
 * Generate brand summary using the LLM
 */
export async function generateBrandSummary(
  pages: PageData[],
  brandName: string,
  existingDescription?: string,
  signal?: AbortSignal
): Promise<BrandSummary> {
  const content = extractContentForAnalysis(pages)

  const descriptions: string[] = []
  if (existingDescription) descriptions.push(existingDescription)
  for (const page of pages) {
    if (page.description) descriptions.push(page.description)
    if (page.ogData['description']) descriptions.push(page.ogData['description'])
  }
  const uniqueDescriptions = [...new Set(descriptions)].slice(0, 5)

  if (!isLlmConfigured()) {
    return createFallbackSummary(pages, brandName, existingDescription)
  }

  const prompt = [
    `Brand name: ${brandName.slice(0, 100)}`,
    untrusted('meta descriptions', uniqueDescriptions),
    untrusted('main headlines', content.heroText),
    untrusted('about page', content.aboutText),
    untrusted('other headings', content.headings),
  ].join('\n\n')

  try {
    const parsed = await generateStructured({ schema: SummarySchema, system: SUMMARY_SYSTEM, prompt, effort: 'low', signal })
    const evidence: Evidence[] = uniqueDescriptions[0]
      ? [{ url: content.pageUrls[0] || 'homepage', snippet: uniqueDescriptions[0].slice(0, 150), context: 'Meta description' }]
      : []

    return {
      name: brandName,
      description: clampText(parsed.description, 800) || existingDescription || 'Brand description not available',
      missionStatement: clampText(parsed.missionStatement, 400) || undefined,
      valueProposition: clampText(parsed.valueProposition, 300) || undefined,
      targetAudience: clampText(parsed.targetAudience, 300) || undefined,
      industry: clampText(parsed.industry, 100) || undefined,
      confidence: inferredConfidence(content),
      source: 'inferred',
      evidence,
    }
  } catch (error) {
    if (signal?.aborted) throw error
    log.error('llm.summary_failed', error)
    return createFallbackSummary(pages, brandName, existingDescription)
  }
}

/**
 * Heuristic tone data when no LLM is configured. Everything here is marked
 * low-confidence and says plainly that it was not AI-analyzed.
 */
function createFallbackToneData(content: AnalysisContent): ToneData {
  const allText = [...content.heroText, ...content.headings, ...content.ctaText].join(' ').toLowerCase()
  const traits: string[] = []

  if (/innovative|cutting-edge|revolutionary|future/i.test(allText)) traits.push('Innovative')
  if (/trusted|reliable|secure|safe/i.test(allText)) traits.push('Trustworthy')
  if (/simple|easy|effortless|streamlined/i.test(allText)) traits.push('Simple')
  if (/professional|enterprise|business/i.test(allText)) traits.push('Professional')
  if (/fun|exciting|adventure|play/i.test(allText)) traits.push('Playful')
  if (/we're|you'll|let's|!/.test(allText)) traits.push('Conversational')

  const evidence: Evidence[] = content.heroText[0]
    ? [{ url: content.pageUrls[0] || 'homepage', snippet: content.heroText[0], context: 'Hero text' }]
    : []

  return {
    traits: traits.slice(0, 7),
    doList: [],
    dontList: [],
    // Real copy from the site, not generated examples
    sampleHeadlines: [],
    sampleCtas: [],
    styleNotes: ['AI voice analysis was unavailable for this report; traits are keyword-based only.'],
    confidence: 25,
    source: 'inferred',
    evidence,
  }
}

/**
 * Create fallback brand summary
 */
function createFallbackSummary(pages: PageData[], brandName: string, existingDescription?: string): BrandSummary {
  const evidence: Evidence[] = []
  let description = existingDescription || ''

  if (!description) {
    const page = pages.find(p => p.description)
    if (page) {
      description = page.description
      evidence.push({ url: page.url, snippet: description.slice(0, 150), context: 'Meta description' })
    }
  }

  return {
    name: brandName,
    description: description || `No description could be found for ${brandName}.`,
    confidence: description ? 50 : 10,
    source: description ? 'extracted' : 'not_found',
    evidence,
  }
}

const InsightsSchema = z.object({
  executiveSummary: z.string(),
  actionItems: z.array(z.string()),
  scoreExplanation: z.string(),
  competitorPositioning: z.string(),
})

const INSIGHTS_SYSTEM = `You are a senior brand strategist writing insights for a brand report. ${UNTRUSTED_CONTENT_RULE}

Return:
- executiveSummary: 2-3 short paragraphs on overall brand strength and positioning, key differentiators, and the main areas needing attention.
- actionItems: 5 concrete recommendations ordered by impact, each stating the expected effect.
- scoreExplanation: one paragraph explaining the consistency score from the breakdown provided. If a dimension had insufficient data, say so rather than inventing a reason.
- competitorPositioning: one paragraph on how the brand appears to position itself in its market and where it may face pressure. Describe apparent strategy only; do not make factual claims about named competitors.
Reference the actual report data. Avoid advice that could apply to any company.`

function describeConsistency(consistency: BrandReport['consistency']): string {
  if (!consistency) return 'Not calculated'
  return JSON.stringify(consistency).slice(0, 2000)
}

/**
 * Generate AI insights. Returns null on failure; the UI hides the section.
 */
export async function generateAIInsights(
  report: Omit<BrandReport, 'aiInsights'>,
  signal?: AbortSignal
): Promise<AIInsights | null> {
  if (!isLlmConfigured()) {
    return null
  }

  const prompt = [
    `Brand: ${report.brandName.slice(0, 100)} (${report.domain})`,
    `Industry: ${report.summary.industry || 'unknown'}`,
    `Value proposition: ${report.summary.valueProposition || 'unknown'}`,
    `Target audience: ${report.summary.targetAudience || 'unknown'}`,
    untrusted('brand description', [report.summary.description]),
    `Brand consistency (JSON): ${describeConsistency(report.consistency)}`,
    `SEO score: ${report.seo.score ?? 'unknown'}/10`,
    untrusted('SEO wins', report.seo.wins.map(w => w.headline)),
    untrusted('SEO issues', report.seo.issues.map(i => i.headline)),
    `Voice traits: ${report.tone.traits.join(', ') || 'unknown'}`,
    `Colors detected: ${report.colors.colors.length}; fonts detected: ${report.typography.fonts.length}`,
    `Social channels: ${report.social.links.map(l => l.platform).join(', ') || 'none found'}`,
    `Pages analyzed: ${report.crawlStats.pagesProcessed}`,
  ].join('\n')

  try {
    const parsed = await generateStructured({ schema: InsightsSchema, system: INSIGHTS_SYSTEM, prompt, effort: 'medium', signal })
    return {
      executiveSummary: clampText(parsed.executiveSummary, 3000),
      actionItems: clampList(parsed.actionItems, 5, 400),
      scoreExplanation: clampText(parsed.scoreExplanation, 1500),
      competitorPositioning: clampText(parsed.competitorPositioning, 1500),
      generatedAt: new Date().toISOString(),
    }
  } catch (error) {
    if (signal?.aborted) throw error
    log.error('llm.insights_failed', error)
    return null
  }
}
