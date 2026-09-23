/**
 * GET /api/status/[id]
 * Report status, partial or final results, and the caller's permissions
 */

import { NextRequest, NextResponse } from 'next/server'
import { getReportView } from '@/lib/report/store'
import { DEMO_ID, DEMO_REPORT } from '@/lib/demo/data'
import { log } from '@/lib/log'
import type { ReportView } from '@/lib/report/types'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (id === DEMO_ID) {
    const view: ReportView = {
      id,
      status: 'completed',
      report: DEMO_REPORT,
      isOwner: false,
      isPublic: true,
      sharePath: DEMO_REPORT.slug ? `/report/${DEMO_REPORT.slug}` : undefined,
      regenerationsLeft: 0,
    }
    return NextResponse.json(view)
  }

  try {
    const view = await getReportView(id, request.cookies)
    if (!view) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }
    return NextResponse.json(view, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    log.error('api.status_failed', error, { reportId: id })
    return NextResponse.json({ error: 'Could not load the report. Please try again.' }, { status: 500 })
  }
}
