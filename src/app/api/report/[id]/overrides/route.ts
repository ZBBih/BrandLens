/**
 * PUT /api/report/[id]/overrides
 * Owner corrects extracted values; exports and the share page use the edits
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { log } from '@/lib/log'
import { readJson } from '@/lib/report/request-guard'
import { requireOwner } from '@/lib/report/require-owner'
import { toView } from '@/lib/report/store'
import type { ReportOverrides } from '@/lib/report/types'

const hex = z.string().regex(/^#[0-9a-f]{6}$/i).transform(value => value.toLowerCase())
// Font and brand names end up in CSS strings, HTML and PDFs: allow ordinary text only
const safeName = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[^<>"'`\\{};]+$/, 'Names cannot contain < > " \' ` \\ { } or ;')

const OverridesSchema = z.object({
  brandName: safeName.optional(),
  colors: z
    .record(hex, z.object({ hex: hex.optional(), role: z.enum(['primary', 'secondary', 'accent', 'background', 'text', 'other']).optional(), hidden: z.boolean().optional() }))
    .refine(value => Object.keys(value).length <= 60, 'Too many color edits')
    .optional(),
  fonts: z
    .record(z.string().max(200), z.object({ name: safeName.optional(), hidden: z.boolean().optional() }))
    .refine(value => Object.keys(value).length <= 30, 'Too many font edits')
    .optional(),
})

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { row, response } = await requireOwner(request, id)
  if (response) return response

  if (row.status !== 'completed') {
    return NextResponse.json({ error: 'Values can be edited once the analysis is complete' }, { status: 409 })
  }

  const parsed = OverridesSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid edits' }, { status: 400 })
  }

  const overrides: ReportOverrides = { ...parsed.data, editedAt: new Date().toISOString() }

  try {
    const updated = await prisma.report.update({ where: { id }, data: { overrides: JSON.stringify(overrides) } })
    return NextResponse.json(toView(updated, request.cookies))
  } catch (error) {
    log.error('api.overrides_failed', error, { reportId: id })
    return NextResponse.json({ error: 'Could not save your edits. Please try again.' }, { status: 500 })
  }
}
