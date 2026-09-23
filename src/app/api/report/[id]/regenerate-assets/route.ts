/**
 * POST /api/report/[id]/regenerate-assets
 * Owner regenerates the AI marketing copy (limited per report)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateMarketingAssets } from '@/lib/analysis/generate-assets'
import { BrandReport } from '@/lib/extractors/types'
import { log } from '@/lib/log'
import { requireOwner } from '@/lib/report/require-owner'
import { MAX_REGENERATIONS } from '@/lib/report/store'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { row, response } = await requireOwner(request, id)
  if (response) return response

  if (row.status !== 'completed' || !row.data) {
    return NextResponse.json({ error: 'Marketing copy can be regenerated once the analysis is complete' }, { status: 409 })
  }

  // Claim a regeneration atomically before spending anything (A22)
  const claimed = await prisma.report.updateMany({
    where: { id, assetsRegenerateCount: { lt: MAX_REGENERATIONS } },
    data: { assetsRegenerateCount: { increment: 1 } },
  })
  if (claimed.count === 0) {
    return NextResponse.json(
      { error: `You've used all ${MAX_REGENERATIONS} regenerations for this report`, regenerationsLeft: 0 },
      { status: 429 }
    )
  }

  const refund = () =>
    prisma.report.update({ where: { id }, data: { assetsRegenerateCount: { decrement: 1 } } }).catch(() => {})

  try {
    const report = JSON.parse(row.data) as BrandReport
    const assets = await generateMarketingAssets(report.domain, report.brandName, report.summary, report.tone, report.marketing)
    if (!assets) {
      await refund()
      return NextResponse.json({ error: 'The copy could not be generated right now. Your regeneration was not used.' }, { status: 502 })
    }

    // Replace only the assets inside the stored JSON, in one statement, so a
    // concurrent write to another part of the report is never lost
    await prisma.$executeRaw`
      UPDATE "Report"
      SET "data" = jsonb_set("data"::jsonb, '{generatedAssets}', ${JSON.stringify(assets)}::jsonb)::text
      WHERE "id" = ${id}`

    const after = await prisma.report.findUnique({ where: { id }, select: { assetsRegenerateCount: true } })
    return NextResponse.json({
      assets,
      regenerationsLeft: Math.max(0, MAX_REGENERATIONS - (after?.assetsRegenerateCount ?? MAX_REGENERATIONS)),
    })
  } catch (error) {
    await refund()
    log.error('api.regenerate_failed', error, { reportId: id })
    return NextResponse.json({ error: 'The copy could not be generated right now. Your regeneration was not used.' }, { status: 500 })
  }
}
