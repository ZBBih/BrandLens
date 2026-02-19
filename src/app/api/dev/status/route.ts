/**
 * GET /api/dev/status
 * Returns dev mode status and available options
 * Only works in development mode
 */

import { NextResponse } from 'next/server'
import { isMockModeEnabled, getAvailableMockDomains } from '@/data/mockData'
import { listLocalCache } from '@/lib/dev/local-cache'

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Dev routes only available in development mode' },
      { status: 403 }
    )
  }

  const mockDomains = getAvailableMockDomains().map(domain => ({ domain }))
  const cacheEntries = listLocalCache()

  return NextResponse.json({
    mockMode: isMockModeEnabled(),
    skipAiInsights: process.env.SKIP_AI_INSIGHTS === 'true',
    localCacheEntries: cacheEntries,
    mockDomains,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      USE_MOCK_DATA: process.env.USE_MOCK_DATA,
      SKIP_AI_INSIGHTS: process.env.SKIP_AI_INSIGHTS,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not configured',
    },
  })
}
