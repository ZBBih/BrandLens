/**
 * POST /api/analyze
 * Start a new brand analysis job
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateUrl, getDomainName } from '@/lib/utils/url'
import { createReport, getCachedReport, runAnalysis } from '@/lib/jobs/analyze'
import { checkRateLimit, recordUsage } from '@/lib/rate-limit'

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
    const { url } = body

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

    // Start analysis in background (don't await)
    runAnalysis(reportId, normalizedUrl).catch(console.error)

    return NextResponse.json({
      id: reportId,
      cached: false,
      status: 'queued',
      remaining: {
        ip: rateCheck.remaining.ip - 1,
        global: rateCheck.remaining.global - 1,
      },
    })
  } catch (error) {
    console.error('Analyze API error:', error)
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    )
  }
}
