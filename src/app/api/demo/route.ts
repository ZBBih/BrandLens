/**
 * GET /api/demo
 * Returns the demo report for instant preview (no database required)
 */

import { NextResponse } from 'next/server'
import { DEMO_ID, DEMO_SLUG, DEMO_REPORT } from '@/lib/demo/data'

export function GET() {
  return NextResponse.json({ reportId: DEMO_ID, slug: DEMO_SLUG, report: DEMO_REPORT })
}
