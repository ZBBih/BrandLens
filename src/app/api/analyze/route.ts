/**
 * POST /api/analyze
 * Start a new brand analysis job
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateUrl, getDomainName } from '@/lib/utils/url'
import { createReport, getCachedReport, runAnalysis } from '@/lib/jobs/analyze'

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

    // Check for cached report
    const cached = await getCachedReport(domain)
    if (cached) {
      return NextResponse.json({
        id: cached.id,
        cached: true,
        status: 'completed',
      })
    }

    // Create new report
    const reportId = await createReport(domain)

    // Start analysis in background (don't await)
    runAnalysis(reportId, normalizedUrl).catch(console.error)

    return NextResponse.json({
      id: reportId,
      cached: false,
      status: 'queued',
    })
  } catch (error) {
    console.error('Analyze API error:', error)
    return NextResponse.json(
      { error: 'Failed to start analysis' },
      { status: 500 }
    )
  }
}
