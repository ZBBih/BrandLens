/**
 * GET /api/pdf/[id]
 * Render the report (with owner edits) as a downloadable PDF
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React, { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { BrandReportDocument } from '@/lib/pdf/generator'
import { DEMO_ID, DEMO_REPORT } from '@/lib/demo/data'
import { BrandReport } from '@/lib/extractors/types'
import { getReportView } from '@/lib/report/store'
import { applyOverrides } from '@/lib/report/overrides'
import { consumeQuotas, PDF_PER_IP_DAILY_LIMIT } from '@/lib/rate-limit'
import { log } from '@/lib/log'
import { getClientIp } from '@/lib/report/client-ip'

// Rendering is CPU-heavy; keep recent PDFs in memory keyed by content version (A23)
const CACHE_LIMIT = 20
const pdfCache = new Map<string, Uint8Array<ArrayBuffer>>()

function remember(key: string, pdf: Uint8Array<ArrayBuffer>) {
  pdfCache.delete(key)
  pdfCache.set(key, pdf)
  if (pdfCache.size > CACHE_LIMIT) {
    pdfCache.delete(pdfCache.keys().next().value as string)
  }
}

function fileName(report: BrandReport): string {
  const base = report.brandName.normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'brand'
  return `${base}-brand-guidelines.pdf`
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    let report: BrandReport
    let version: string

    if (id === DEMO_ID) {
      report = DEMO_REPORT
      version = 'demo'
    } else {
      const view = await getReportView(id, request.cookies)
      if (!view || view.status !== 'completed' || !view.report) {
        return NextResponse.json({ error: 'This report is not ready to download' }, { status: 404 })
      }
      report = applyOverrides(view.report, view.overrides)
      version = [report.generatedAt, view.overrides?.editedAt, report.generatedAssets?.generatedAt].join('|')
    }

    const cacheKey = `${id}|${version}`
    let pdf = pdfCache.get(cacheKey)

    if (!pdf) {
      const quota = await consumeQuotas([{ key: `pdf:ip:${getClientIp(request.headers)}`, limit: PDF_PER_IP_DAILY_LIMIT }])
      if (!quota.allowed) {
        return NextResponse.json({ error: 'Daily PDF download limit reached. It resets at midnight UTC.' }, { status: 429 })
      }
      const buffer = await renderToBuffer(React.createElement(BrandReportDocument, { report }) as ReactElement<DocumentProps>)
      pdf = new Uint8Array(buffer)
      remember(cacheKey, pdf)
    }

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName(report)}"`,
        'Content-Length': String(pdf.byteLength),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    log.error('api.pdf_failed', error, { reportId: id })
    return NextResponse.json({ error: 'The PDF could not be generated. Please try again.' }, { status: 500 })
  }
}
