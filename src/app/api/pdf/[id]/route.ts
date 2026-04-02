/**
 * GET /api/pdf/[id]
 * Generate and download PDF report
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getReport } from '@/lib/jobs/analyze'
import { BrandReportDocument } from '@/lib/pdf/generator'
import { DEMO_ID, DEMO_REPORT } from '@/lib/demo/data'
import { BrandReport } from '@/lib/extractors/types'
import React, { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    console.log(`[PDF] Request for report ID: ${id}`)

    if (!id) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    let report: BrandReport | undefined

    // Handle demo report specially - it's not in the database
    if (id === DEMO_ID) {
      console.log('[PDF] Using hardcoded demo report data')
      report = DEMO_REPORT
    } else {
      // Fetch from database for real reports
      console.log(`[PDF] Fetching report from database: ${id}`)
      const result = await getReport(id)

      if (!result) {
        console.error(`[PDF] Report not found in database. ID searched: ${id}`)
        return NextResponse.json(
          { error: `Report not found. ID: ${id}` },
          { status: 404 }
        )
      }

      console.log(`[PDF] Database result - status: ${result.status}, hasReport: ${!!result.report}`)

      if (result.status !== 'completed') {
        console.log(`[PDF] Report not completed. Current status: ${result.status}`)
        return NextResponse.json(
          { error: `Report is not yet completed. Status: ${result.status}` },
          { status: 400 }
        )
      }

      if (!result.report) {
        console.error(`[PDF] Report completed but no data found. ID: ${id}`)
        return NextResponse.json(
          { error: 'Report completed but data is missing' },
          { status: 500 }
        )
      }

      report = result.report
    }

    console.log(`[PDF] Generating PDF for: ${report.brandName}`)

    // Generate PDF
    const pdfBuffer = await renderToBuffer(
      React.createElement(BrandReportDocument, { report }) as ReactElement<DocumentProps>
    )

    // Return PDF as download
    const filename = `${report.brandName.replace(/[^a-zA-Z0-9]/g, '-')}-brand-guidelines.pdf`

    console.log(`[PDF] PDF generated successfully. Size: ${pdfBuffer.length} bytes, Filename: ${filename}`)

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
    console.error('[PDF] Generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
