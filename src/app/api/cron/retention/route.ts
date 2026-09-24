/**
 * GET /api/cron/retention
 * Daily Vercel Cron: delete expired reports and old rate-limit counters (A48, G19)
 */

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { sweepExpiredReports } from '@/lib/report/store'
import { pruneCounters } from '@/lib/rate-limit'
import { log } from '@/lib/log'

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function GET(request: NextRequest) {
  // Vercel Cron sends CRON_SECRET as a bearer token; nothing else may trigger this
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const reports = await sweepExpiredReports()
    const counters = await pruneCounters()
    log.info('retention.swept', { reports, counters })
    return NextResponse.json({ reports, counters })
  } catch (error) {
    log.error('retention.failed', error)
    return NextResponse.json({ error: 'Retention sweep failed' }, { status: 500 })
  }
}
