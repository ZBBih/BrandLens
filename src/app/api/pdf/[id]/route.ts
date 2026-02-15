/**
 * GET /api/pdf/[id]
 * Generate and download PDF report
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getReport } from '@/lib/jobs/analyze'
import { BrandReportDocument } from '@/lib/pdf/generator'
import React, { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    const result = await getReport(id)

    if (!result) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      )
    }

    if (result.status !== 'completed' || !result.report) {
      return NextResponse.json(
        { error: 'Report is not yet completed' },
        { status: 400 }
      )
    }

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(BrandReportDocument, { report: result.report }) as ReactElement<DocumentProps>
    )

    // Return PDF as download
    const filename = `${result.report.brandName.replace(/[^a-zA-Z0-9]/g, '-')}-brand-guidelines.pdf`

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(pdfBuffer)

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    )
  }
}
