/**
 * GET /api/public-report/[slug]
 * Get a public report by slug
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { BrandReport } from '@/lib/extractors/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const report = await prisma.report.findFirst({
      where: {
        slug,
        isPublic: true,
        status: 'completed',
      },
    })

    if (!report || !report.data) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Increment view count
    await prisma.report.update({
      where: { id: report.id },
      data: { publicViews: { increment: 1 } },
    })

    const reportData = JSON.parse(report.data) as BrandReport

    return NextResponse.json({
      report: reportData,
    })
  } catch (error) {
    console.error('Public report fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    )
  }
}
