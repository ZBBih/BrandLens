/**
 * GET /api/rate-limit
 * Get current rate limit status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUsageStats, getLimits } from '@/lib/rate-limit'

/**
 * Get client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return '127.0.0.1'
}

export async function GET(request: NextRequest) {
  try {
    const clientIp = getClientIp(request)
    const stats = getUsageStats(clientIp)
    const limits = getLimits()

    return NextResponse.json({
      remaining: {
        ip: stats.ipRemaining,
        global: stats.globalRemaining,
      },
      used: {
        ip: stats.ipUsed,
        global: stats.globalUsed,
      },
      limits: {
        perIp: limits.perIp,
        global: limits.global,
      },
    })
  } catch (error) {
    console.error('Rate limit API error:', error)
    return NextResponse.json(
      { error: 'Failed to get rate limit status' },
      { status: 500 }
    )
  }
}
