/**
 * Analysis job processor
 * Orchestrates the full brand analysis pipeline
 */

import { prisma } from '../db'
import { crawl, CrawlProgress, PageData } from '../crawler'
import {
  extractTypography,
  extractColors,
  extractSeo,
  extractGeo,
  extractSocial,
  extractMarketing,
  extractLogo,
  BrandReport,
  TypographyData,
  ColorData,
  SeoData,
  GeoData,
  SocialData,
  MarketingData,
  ToneData,
  BrandSummary,
} from '../extractors'
import { fetchBrandfetchData, mergeBrandfetchData } from '../enrichment/brandfetch'
import { analyzeToneVoice, generateBrandSummary, generateAIInsights } from '../analysis/tone-voice'
import { calculateConsistencyScore } from '../analysis/consistency-score'
import { generateMarketingAssets } from '../analysis/generate-assets'
import { getDomainName } from '../utils/url'

export type JobStatus = 'queued' | 'crawling' | 'extracting' | 'analyzing' | 'generating' | 'completed' | 'failed'

/**
 * Generate a URL-friendly slug for the report
 */
function generateSlug(domain: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  // Remove TLD and clean up domain
  const baseName = domain
    .replace(/\.(com|org|net|io|co|app|dev|xyz|info|biz)$/i, '')
    .replace(/[^a-zA-Z0-9]/g, '-')
    .toLowerCase()

  // Add random suffix for uniqueness
  const randomSuffix = Math.random().toString(36).substring(2, 6)

  return `${baseName}-${year}-${month}-${randomSuffix}`
}

export interface JobProgress {
  status: JobStatus
  currentUrl?: string
  pagesProcessed?: number
  step?: string
}

/**
 * Update job status in database
 */
async function updateJobStatus(
  reportId: string,
  status: JobStatus,
  progress?: Partial<JobProgress>,
  data?: string,
  error?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    progress: progress ? JSON.stringify(progress) : undefined,
  }

  if (data) {
    updateData.data = data
  }

  if (error) {
    updateData.error = error
  }

  if (status === 'completed') {
    updateData.completedAt = new Date()
  }

  await prisma.report.update({
    where: { id: reportId },
    data: updateData,
  })
}

/**
 * Run the full analysis pipeline
 */
export async function runAnalysis(reportId: string, url: string): Promise<void> {
  const domain = getDomainName(url)

  try {
    // Phase 1: Crawling
    await updateJobStatus(reportId, 'crawling', {
      status: 'crawling',
      step: 'Starting crawler...',
      pagesProcessed: 0,
    })

    let lastProgress: CrawlProgress | null = null
    const crawlResult = await crawl(url, (progress) => {
      lastProgress = progress
      // Update progress periodically (not on every callback to reduce DB writes)
      if (progress.pagesProcessed % 3 === 0) {
        updateJobStatus(reportId, 'crawling', {
          status: 'crawling',
          currentUrl: progress.currentUrl,
          pagesProcessed: progress.pagesProcessed,
          step: `Crawling page ${progress.pagesProcessed + 1}...`,
        }).catch(console.error)
      }
    })

    if (crawlResult.pages.length === 0) {
      throw new Error('No pages could be crawled. Check the URL and try again.')
    }

    // Phase 2: Extracting
    await updateJobStatus(reportId, 'extracting', {
      status: 'extracting',
      step: 'Extracting brand elements...',
      pagesProcessed: crawlResult.pages.length,
    })

    // Run all extractors
    const typography = extractTypography(crawlResult.pages, crawlResult.cssContents)
    const colors = extractColors(crawlResult.pages, crawlResult.cssContents)
    const seo = extractSeo(crawlResult.pages)
    const geo = extractGeo(crawlResult.pages)
    const social = extractSocial(crawlResult.pages)
    const marketing = extractMarketing(crawlResult.pages)
    const logoData = extractLogo(crawlResult.pages)

    // Phase 3: Enrichment (Brandfetch)
    await updateJobStatus(reportId, 'extracting', {
      status: 'extracting',
      step: 'Enriching with brand data...',
    })

    let brandName = domain
    let logoUrl: string | undefined = logoData.logoUrl // Start with extracted logo
    let enrichedColors = colors
    let enrichedTypography = typography
    let enrichedSocial = social
    let brandfetchDescription: string | undefined

    const brandfetchData = await fetchBrandfetchData(domain)
    if (brandfetchData) {
      brandName = brandfetchData.name || brandName
      // Brandfetch logo takes priority over extracted
      logoUrl = brandfetchData.logoUrl || logoUrl
      brandfetchDescription = brandfetchData.description

      // Merge colors (Brandfetch takes priority)
      if (brandfetchData.colors.length > 0) {
        enrichedColors = {
          colors: mergeBrandfetchData(
            colors.colors,
            brandfetchData.colors,
            (c) => c.hex.toLowerCase()
          ),
        }
      }

      // Merge fonts
      if (brandfetchData.fonts.length > 0) {
        enrichedTypography = {
          ...typography,
          fonts: mergeBrandfetchData(
            typography.fonts,
            brandfetchData.fonts,
            (f) => f.name.toLowerCase()
          ),
        }
      }

      // Merge social links
      if (brandfetchData.socialLinks.length > 0) {
        enrichedSocial = {
          links: mergeBrandfetchData(
            social.links,
            brandfetchData.socialLinks,
            (s) => s.platform
          ),
        }
      }
    }

    // Phase 4: Analysis (Claude API)
    await updateJobStatus(reportId, 'analyzing', {
      status: 'analyzing',
      step: 'Analyzing brand voice and tone...',
    })

    const tone = await analyzeToneVoice(crawlResult.pages)
    const summary = await generateBrandSummary(crawlResult.pages, brandName, brandfetchDescription)

    // Phase 5: Calculate consistency score
    await updateJobStatus(reportId, 'analyzing', {
      status: 'analyzing',
      step: 'Calculating brand consistency...',
    })

    const consistency = await calculateConsistencyScore(
      crawlResult.pages,
      crawlResult.cssContents,
      enrichedColors.colors,
      enrichedTypography.fonts,
      tone
    )

    // Phase 6: Generate marketing assets
    await updateJobStatus(reportId, 'generating', {
      status: 'generating',
      step: 'Generating marketing assets...',
    })

    const generatedAssets = await generateMarketingAssets(
      domain,
      brandName,
      summary,
      tone,
      marketing
    )

    // Generate slug for public sharing
    const slug = generateSlug(domain)

    // Phase 7: Generate AI Insights
    await updateJobStatus(reportId, 'generating', {
      status: 'generating',
      step: 'Generating AI insights...',
    })

    // Build partial report for AI insights generation
    const partialReport = {
      id: reportId,
      domain,
      brandName,
      logoUrl,
      summary,
      typography: enrichedTypography,
      colors: enrichedColors,
      seo,
      geo,
      social: enrichedSocial,
      marketing,
      tone,
      consistency,
      generatedAssets: generatedAssets || undefined,
      crawlStats: {
        pagesProcessed: crawlResult.pages.length,
        duration: (crawlResult.endTime - crawlResult.startTime) / 1000,
        errors: crawlResult.errors,
      },
      generatedAt: new Date().toISOString(),
      cached: false,
      slug,
      isPublic: false,
    }

    const aiInsights = await generateAIInsights(partialReport)

    // Phase 8: Compile final report
    await updateJobStatus(reportId, 'generating', {
      status: 'generating',
      step: 'Compiling report...',
    })

    const report: BrandReport = {
      ...partialReport,
      aiInsights: aiInsights || undefined,
    }

    // Save completed report with additional fields
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        data: JSON.stringify(report),
        consistencyScore: consistency.score,
        consistencyGrade: consistency.grade,
        consistencyBreakdown: JSON.stringify(consistency.breakdown),
        consistencyIssues: JSON.stringify(consistency.issues),
        generatedAssets: generatedAssets ? JSON.stringify(generatedAssets) : null,
        assetsGeneratedAt: generatedAssets ? new Date() : null,
        aiInsights: aiInsights ? JSON.stringify(aiInsights) : null,
        slug,
      },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    console.error(`Analysis failed for ${reportId}:`, error)
    await updateJobStatus(reportId, 'failed', undefined, undefined, errorMessage)
  }
}

/**
 * Get report by ID
 */
export async function getReport(reportId: string): Promise<{
  status: JobStatus
  progress?: JobProgress
  report?: BrandReport
  error?: string
} | null> {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
  })

  if (!report) {
    return null
  }

  const result: {
    status: JobStatus
    progress?: JobProgress
    report?: BrandReport
    error?: string
  } = {
    status: report.status as JobStatus,
  }

  if (report.progress) {
    try {
      result.progress = JSON.parse(report.progress)
    } catch {
      // Invalid progress JSON
    }
  }

  if (report.data) {
    try {
      result.report = JSON.parse(report.data)
    } catch {
      // Invalid data JSON
    }
  }

  if (report.error) {
    result.error = report.error
  }

  return result
}

/**
 * Check for cached report
 */
export async function getCachedReport(domain: string): Promise<{
  id: string
  report: BrandReport
} | null> {
  const cached = await prisma.report.findFirst({
    where: {
      domain,
      status: 'completed',
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!cached || !cached.data) {
    return null
  }

  try {
    const report = JSON.parse(cached.data) as BrandReport
    report.cached = true
    return { id: cached.id, report }
  } catch {
    return null
  }
}

/**
 * Create a new report entry
 */
export async function createReport(domain: string): Promise<string> {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 24)

  const report = await prisma.report.create({
    data: {
      domain,
      status: 'queued',
      expiresAt,
    },
  })

  return report.id
}
