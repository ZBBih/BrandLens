/**
 * GET /api/demo
 * Returns the demo report for instant preview (no database required)
 */

import { NextResponse } from 'next/server'
import { DEMO_REPORT } from '@/data/demo-report'

const DEMO_ID = 'demo-nike-report'
const DEMO_SLUG = 'demo-nike-brand'

export async function GET() {
  try {
    const report = {
      ...DEMO_REPORT,
      id: DEMO_ID,
      slug: DEMO_SLUG,
    }

    return NextResponse.json({
      success: true,
      reportId: DEMO_ID,
      slug: DEMO_SLUG,
      report,
    })
  } catch (error) {
    console.error('Demo report error:', error)
    return NextResponse.json(
      { error: 'Failed to load demo report' },
      { status: 500 }
    )
  }
}
