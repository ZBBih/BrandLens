/**
 * Analysis job processor
 * Orchestrates the full brand analysis pipeline
 */

import { prisma } from '../db'
import { crawl, CrawlProgress } from '../crawler'
import {
  extractTypography,
  extractColors,
  extractSeo,
  extractGeo,
  extractSocial,
  extractMarketing,
  extractLogo,
  extractBrandName,
  BrandReport,
  ToneData,
  BrandSummary,
} from '../extractors'
import { fetchBrandfetchData, mergeBrandfetchData } from '../enrichment/brandfetch'
import { analyzeToneVoice, generateBrandSummary, generateAIInsights } from '../analysis/tone-voice'
import { calculateConsistencyScore } from '../analysis/consistency-score'
import { generateMarketingAssets } from '../analysis/generate-assets'
import { getDomainName } from '../utils/url'
import { CACHE_TTL_MS } from '../report/store'
import { log } from '../log'

export type JobStatus = 'queued' | 'crawling' | 'extracting' | 'analyzing' | 'generating' | 'completed' | 'failed'

export interface JobProgress {
  status: JobStatus
  step: string
  /** Honest overall progress, 0-100; only reaches 100 when the report is saved */
  percent: number
  startedAt: string
  currentUrl?: string
  pagesProcessed?: number
  totalFound?: number
}

/** Hard ceiling for one analysis, crawl plus every model call */
const JOB_DEADLINE_MS = 4 * 60 * 1000
const CRAWL_DEADLINE_MS = 150 * 1000
const HEARTBEAT_MS = 5 * 1000
const MAX_PAGES = 25

/** Failure whose message is safe and useful to show the user */
class UserFacingError extends Error {}

/**
 * Settle with `promise`, or reject as soon as `signal` aborts. The job
 * deadline must hold even if some await deep inside ignores cancellation,
 * because the platform kills the invocation at maxDuration regardless.
 */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason)
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(
      value => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      error => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

const GENERIC_FAILURE = 'The analysis failed unexpectedly. Please try again in a few minutes.'
const TIMEOUT_FAILURE = 'The analysis took too long and was stopped. Sites that load very slowly may not be analysable.'

const emptySummary = (name: string): BrandSummary => ({
  name,
  description: '',
  confidence: 0,
  source: 'not_found',
  evidence: [],
})

const emptyTone = (): ToneData => ({
  traits: [],
  doList: [],
  dontList: [],
  sampleHeadlines: [],
  sampleCtas: [],
  styleNotes: [],
  confidence: 0,
  source: 'not_found',
  evidence: [],
})

/**
 * Run the full analysis pipeline for a queued report
 */
export async function runAnalysis(reportId: string, url: string): Promise<void> {
  const domain = getDomainName(url)
  const startedAt = new Date().toISOString()
  const controller = new AbortController()
  const deadline = setTimeout(() => controller.abort(new Error('deadline')), JOB_DEADLINE_MS)
  const signal = controller.signal

  const heartbeat = setInterval(() => {
    prisma.report.update({ where: { id: reportId }, data: { heartbeatAt: new Date() } }).catch(() => {})
  }, HEARTBEAT_MS)

  const setProgress = (progress: Omit<JobProgress, 'startedAt'>, data?: BrandReport) =>
    prisma.report.update({
      where: { id: reportId },
      data: {
        status: progress.status,
        progress: JSON.stringify({ ...progress, startedAt }),
        heartbeatAt: new Date(),
        ...(data ? { data: JSON.stringify(data) } : {}),
      },
    })

  try {
    await setProgress({ status: 'crawling', step: 'Reading the website...', percent: 3 })

    // Brandfetch only needs the domain, so it runs alongside the crawl
    const brandfetchPromise = fetchBrandfetchData(domain).catch(() => null)

    let lastProgressWrite = 0
    const crawlResult = await untilAborted(crawl(
      url,
      (progress: CrawlProgress) => {
        const now = Date.now()
        if (now - lastProgressWrite < 1000) return
        lastProgressWrite = now
        const fraction = Math.min(1, progress.pagesProcessed / Math.max(1, Math.min(MAX_PAGES, progress.totalFound || MAX_PAGES)))
        setProgress({
          status: 'crawling',
          step: `Reading page ${progress.pagesProcessed + 1}...`,
          percent: Math.round(5 + fraction * 40),
          currentUrl: progress.currentUrl,
          pagesProcessed: progress.pagesProcessed,
          totalFound: progress.totalFound,
        }).catch(() => {})
      },
      { signal, deadlineMs: CRAWL_DEADLINE_MS }
    ), signal)

    if (crawlResult.pages.length === 0) {
      throw new UserFacingError(
        'No pages could be read from this site. It may block automated visitors, disallow crawling in robots.txt, or be offline.'
      )
    }

    await setProgress({ status: 'extracting', step: 'Extracting colors, fonts and content...', percent: 46, pagesProcessed: crawlResult.pages.length })

    const typography = extractTypography(crawlResult.pages, crawlResult.cssContents)
    const colors = extractColors(crawlResult.pages, crawlResult.cssContents)
    const seo = extractSeo(crawlResult.pages)
    const geo = extractGeo(crawlResult.pages)
    const social = extractSocial(crawlResult.pages)
    const marketing = extractMarketing(crawlResult.pages)
    const logoData = extractLogo(crawlResult.pages)

    let brandName = extractBrandName(crawlResult.pages, domain)
    let logoUrl = logoData.logoUrl
    let enrichedColors = colors
    let enrichedTypography = typography
    let enrichedSocial = social
    let brandfetchDescription: string | undefined

    const brandfetchData = await brandfetchPromise
    if (brandfetchData) {
      brandName = brandfetchData.name || brandName
      // An unclaimed Brandfetch logo is a guess; the logo found on the site wins over it
      logoUrl = brandfetchData.verified ? brandfetchData.logoUrl || logoUrl : logoUrl || brandfetchData.logoUrl || undefined
      brandfetchDescription = brandfetchData.description

      if (brandfetchData.colors.length > 0) {
        enrichedColors = { colors: mergeBrandfetchData(colors.colors, brandfetchData.colors, c => c.hex.toLowerCase()) }
      }
      if (brandfetchData.fonts.length > 0) {
        enrichedTypography = { ...typography, fonts: mergeBrandfetchData(typography.fonts, brandfetchData.fonts, f => f.name.toLowerCase()) }
      }
      if (brandfetchData.socialLinks.length > 0) {
        enrichedSocial = { links: mergeBrandfetchData(social.links, brandfetchData.socialLinks, s => s.platform) }
      }
    }

    const report: BrandReport = {
      id: reportId,
      domain,
      brandName,
      logoUrl,
      summary: emptySummary(brandName),
      typography: enrichedTypography,
      colors: enrichedColors,
      seo,
      geo,
      social: enrichedSocial,
      marketing,
      tone: emptyTone(),
      crawlStats: {
        pagesProcessed: crawlResult.pages.length,
        duration: (crawlResult.endTime - crawlResult.startTime) / 1000,
        errors: crawlResult.errors.slice(0, 20),
      },
      generatedAt: new Date().toISOString(),
      cached: false,
    }

    // Visual identity is ready: publish it so the user can start reviewing
    await setProgress({ status: 'analyzing', step: 'Analyzing voice and positioning...', percent: 55 }, report)

    const [tone, summary] = await untilAborted(Promise.all([
      analyzeToneVoice(crawlResult.pages, signal),
      generateBrandSummary(crawlResult.pages, brandName, brandfetchDescription, signal),
    ]), signal)
    report.tone = tone
    report.summary = summary

    report.consistency = await calculateConsistencyScore(
      crawlResult.pages,
      crawlResult.cssContents,
      enrichedColors.colors,
      enrichedTypography.fonts,
      tone
    )

    await setProgress({ status: 'generating', step: 'Writing marketing copy and insights...', percent: 78 }, report)

    const [generatedAssets, aiInsights] = await untilAborted(Promise.all([
      generateMarketingAssets(domain, brandName, summary, tone, marketing, signal),
      generateAIInsights(report, signal),
    ]), signal)
    report.generatedAssets = generatedAssets ?? undefined
    report.aiInsights = aiInsights ?? undefined
    report.generatedAt = new Date().toISOString()

    const completedAt = new Date()
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'completed',
        completedAt,
        expiresAt: new Date(completedAt.getTime() + CACHE_TTL_MS),
        heartbeatAt: completedAt,
        data: JSON.stringify(report),
        progress: JSON.stringify({ status: 'completed', step: 'Done', percent: 100, startedAt } satisfies JobProgress),
      },
    })

    log.info('analysis.completed', {
      reportId,
      domain,
      pages: crawlResult.pages.length,
      crawlMs: crawlResult.endTime - crawlResult.startTime,
      totalMs: completedAt.getTime() - Date.parse(startedAt),
      aiDegraded: !generatedAssets || !aiInsights,
    })
  } catch (error) {
    const message =
      error instanceof UserFacingError ? error.message : signal.aborted ? TIMEOUT_FAILURE : GENERIC_FAILURE
    log.error('analysis.failed', error, { reportId, domain, totalMs: Date.now() - Date.parse(startedAt), userFacing: error instanceof UserFacingError, timedOut: signal.aborted })
    await prisma.report
      .update({ where: { id: reportId }, data: { status: 'failed', error: message, heartbeatAt: new Date() } })
      .catch(dbError => log.error('analysis.record_failure_failed', dbError, { reportId }))
  } finally {
    clearTimeout(deadline)
    clearInterval(heartbeat)
  }
}
