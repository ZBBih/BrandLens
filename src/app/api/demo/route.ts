/**
 * GET /api/demo
 * Returns or creates a demo report for instant preview
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { DEMO_REPORT } from '@/data/demo-report'
import { v4 as uuid } from 'uuid'

function generateSlug(): string {
  const adjectives = ['amazing', 'brilliant', 'creative', 'dynamic', 'elegant']
  const nouns = ['brand', 'design', 'studio', 'vision', 'spark']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  const num = Math.floor(Math.random() * 1000)
  return `${adj}-${noun}-${num}`
}

export async function GET() {
  try {
    // Check if we already have a demo report
    let demoReport = await prisma.report.findFirst({
      where: { isDemo: true },
      select: { id: true, data: true, slug: true },
    })

    if (!demoReport) {
      // Create the demo report
      const id = uuid()
      const slug = `demo-${generateSlug()}`
      const expiresAt = new Date()
      expiresAt.setFullYear(expiresAt.getFullYear() + 10) // Demo never expires

      const reportData = {
        ...DEMO_REPORT,
        id,
        slug,
      }

      demoReport = await prisma.report.create({
        data: {
          id,
          domain: DEMO_REPORT.domain,
          status: 'completed',
          data: JSON.stringify(reportData),
          slug,
          isPublic: true,
          isDemo: true,
          expiresAt,
          completedAt: new Date(),
          consistencyScore: DEMO_REPORT.consistency?.score,
          consistencyGrade: DEMO_REPORT.consistency?.grade,
          consistencyBreakdown: JSON.stringify(DEMO_REPORT.consistency?.breakdown),
          consistencyIssues: JSON.stringify(DEMO_REPORT.consistency?.issues),
          generatedAssets: JSON.stringify(DEMO_REPORT.generatedAssets),
          assetsGeneratedAt: new Date(),
        },
        select: { id: true, data: true, slug: true },
      })
    }

    // Parse the report data
    const report = JSON.parse(demoReport.data as string)

    return NextResponse.json({
      success: true,
      reportId: demoReport.id,
      slug: demoReport.slug,
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
