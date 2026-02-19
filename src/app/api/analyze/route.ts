/**
 * POST /api/analyze
 * Start a new brand analysis job
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateUrl, getDomainName } from '@/lib/utils/url'
import { createReport, getCachedReport, runAnalysis } from '@/lib/jobs/analyze'
import { checkRateLimit, recordUsage } from '@/lib/rate-limit'
import { getMockReport, isMockModeEnabled } from '@/data/mockData'
import { getLocalCache, saveLocalCache } from '@/lib/dev/local-cache'

/**
 * Get client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  // Check various headers for the real IP (behind proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback - this may not work in all environments
  return '127.0.0.1'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, useLocalCache, skipAiInsights } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    const validation = validateUrl(url)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const normalizedUrl = validation.url!
    const domain = getDomainName(normalizedUrl)

    // DEV MODE: Check for mock data first (instant response)
    if (isMockModeEnabled()) {
      const mockReport = getMockReport(domain)
      if (mockReport) {
        return NextResponse.json({
          id: mockReport.id,
          cached: true,
          mock: true,
          status: 'completed',
          report: mockReport,
        })
      }
    }

    // DEV MODE: Check for local cache if requested
    if (process.env.NODE_ENV === 'development' && useLocalCache) {
      const localCached = getLocalCache(domain)
      if (localCached) {
        return NextResponse.json({
          id: localCached.report.id || `local-${Date.now()}`,
          cached: true,
          localCache: true,
          status: 'completed',
          report: localCached.report,
          cachedAt: localCached.cachedAt,
        })
      }
    }

    // Check for cached report (doesn't count against rate limit)
    const cached = await getCachedReport(domain)
    if (cached) {
      return NextResponse.json({
        id: cached.id,
        cached: true,
        status: 'completed',
      })
    }

    // Check rate limit for new analyses only
    const clientIp = getClientIp(request)
    const rateCheck = checkRateLimit(clientIp)

    if (!rateCheck.allowed) {
      const message = rateCheck.reason === 'ip_limit'
        ? 'You\'ve reached your daily limit of 3 analyses. Try again tomorrow or contact me for access.'
        : 'Daily limit reached. Try again tomorrow or contact me for access.'

      return NextResponse.json(
        {
          error: message,
          rateLimited: true,
          remaining: rateCheck.remaining,
        },
        { status: 429 }
      )
    }

    // Create new report
    const reportId = await createReport(domain)

    // Record the usage
    recordUsage(clientIp)

    // DEV MODE: Pass options for skipping AI insights
    const analysisOptions = {
      skipAiInsights: process.env.NODE_ENV === 'development' &&
        (skipAiInsights || process.env.SKIP_AI_INSIGHTS === 'true'),
      saveToLocalCache: process.env.NODE_ENV === 'development',
    }

    // Start analysis in background (don't await)
    runAnalysis(reportId, normalizedUrl, analysisOptions).catch(console.error)

    return NextResponse.json({
      id: reportId,
      cached: false,
      status: 'queued',
      remaining: {
        ip: rateCheck.remaining.ip - 1,
        global: rateCheck.remaining.global - 1,
      },
      devMode: process.env.NODE_ENV === 'development',
    })
  } catch (error) {
    console.error('Analyze API error:', error)
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    )
  }
}
