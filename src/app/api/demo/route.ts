/**
 * GET /api/demo
 * Returns the demo report for instant preview (no database required)
 */

import { NextResponse } from 'next/server'
import { DEMO_ID, DEMO_SLUG, DEMO_REPORT } from '@/lib/demo/data'

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      reportId: DEMO_ID,
      slug: DEMO_SLUG,
      report: DEMO_REPORT,
    })
  } catch (error) {
    console.error('Demo report error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      {
        error: 'Failed to load demo report',
        details: errorMessage,
        stack: errorStack
      },
      { status: 500 }
    )
  }
}
