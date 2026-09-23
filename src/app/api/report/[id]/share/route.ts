/**
 * POST /api/report/[id]/share
 * Owner turns the public share link on or off
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { log } from '@/lib/log'
import { readJson } from '@/lib/report/request-guard'
import { requireOwner } from '@/lib/report/require-owner'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { row, response } = await requireOwner(request, id)
  if (response) return response

  const body = await readJson(request)
  const isPublic = typeof body === 'object' && body !== null ? (body as { isPublic?: unknown }).isPublic : undefined
  if (typeof isPublic !== 'boolean') {
    return NextResponse.json({ error: 'isPublic must be true or false' }, { status: 400 })
  }
  if (isPublic && row.status !== 'completed') {
    return NextResponse.json({ error: 'A report can be shared once the analysis is complete' }, { status: 409 })
  }

  try {
    const updated = await prisma.report.update({ where: { id }, data: { isPublic }, select: { slug: true, isPublic: true } })
    return NextResponse.json({ isPublic: updated.isPublic, sharePath: `/report/${updated.slug}` })
  } catch (error) {
    log.error('api.share_failed', error, { reportId: id })
    return NextResponse.json({ error: 'Could not update sharing. Please try again.' }, { status: 500 })
  }
}
