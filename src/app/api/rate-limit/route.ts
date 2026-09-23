/**
 * GET /api/rate-limit
 * Remaining free analyses for the caller today
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAnalyzeUsage } from '@/lib/rate-limit'
import { log } from '@/lib/log'
import { getClientIp } from '@/lib/report/client-ip'

export async function GET(request: NextRequest) {
  try {
    const usage = await getAnalyzeUsage(getClientIp(request.headers))
    return NextResponse.json(usage, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    log.error('api.rate_limit_failed', error)
    return NextResponse.json({ error: 'Could not load usage' }, { status: 500 })
  }
}
