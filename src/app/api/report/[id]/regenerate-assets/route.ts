/**
 * POST /api/report/[id]/regenerate-assets
 * Regenerate AI marketing assets for a report
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateMarketingAssets } from '@/lib/analysis/generate-assets'
import { BrandReport } from '@/lib/extractors/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const report = await prisma.report.findUnique({
      where: { id },
      select: {
        id: true,
        data: true,
        assetsRegenerateCount: true,
      },
    })

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Check regeneration limit
    if (report.assetsRegenerateCount >= 3) {
      return NextResponse.json(
        { error: 'Regeneration limit reached (max 3)' },
        { status: 429 }
      )
    }

    if (!report.data) {
      return NextResponse.json(
        { error: 'Report data not found' },
        { status: 400 }
      )
    }

    const reportData = JSON.parse(report.data) as BrandReport

    // Generate new assets
    const newAssets = await generateMarketingAssets(
      reportData.domain,
      reportData.brandName,
      reportData.summary,
      reportData.tone,
      reportData.marketing
    )

    if (!newAssets) {
      return NextResponse.json(
        { error: 'Failed to generate assets' },
        { status: 500 }
      )
    }

    // Update report with new assets
    reportData.generatedAssets = newAssets

    await prisma.report.update({
      where: { id },
      data: {
        data: JSON.stringify(reportData),
        generatedAssets: JSON.stringify(newAssets),
        assetsGeneratedAt: new Date(),
        assetsRegenerateCount: report.assetsRegenerateCount + 1,
      },
    })

    return NextResponse.json({
      success: true,
      assets: newAssets,
      regenerateCount: report.assetsRegenerateCount + 1,
    })
  } catch (error) {
    console.error('Asset regeneration error:', error)
    return NextResponse.json(
      { error: 'Failed to regenerate assets' },
      { status: 500 }
    )
  }
}
