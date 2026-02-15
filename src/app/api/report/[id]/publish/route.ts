/**
 * POST /api/report/[id]/publish
 * Toggle public visibility of a report
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { isPublic } = body

    if (typeof isPublic !== 'boolean') {
      return NextResponse.json(
        { error: 'isPublic must be a boolean' },
        { status: 400 }
      )
    }

    const report = await prisma.report.findUnique({
      where: { id },
      select: { id: true, slug: true },
    })

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    // Update public status
    const updated = await prisma.report.update({
      where: { id },
      data: { isPublic },
      select: { slug: true, isPublic: true },
    })

    return NextResponse.json({
      success: true,
      slug: updated.slug,
      isPublic: updated.isPublic,
    })
  } catch (error) {
    console.error('Publish toggle error:', error)
    return NextResponse.json(
      { error: 'Failed to update report visibility' },
      { status: 500 }
    )
  }
}
