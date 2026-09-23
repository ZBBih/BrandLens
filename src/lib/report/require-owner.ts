/**
 * Guard for owner-only report mutations
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Report } from '@prisma/client'
import { isOwner } from './ownership'
import { rejectUnsafeMutation } from './request-guard'
import { getReportRow } from './store'

export async function requireOwner(
  request: NextRequest,
  id: string
): Promise<{ row: Report; response?: undefined } | { row?: undefined; response: NextResponse }> {
  const rejected = rejectUnsafeMutation(request)
  if (rejected) return { response: rejected }

  const row = await getReportRow(id)
  // Same response for "missing" and "not yours", so ids can't be probed
  if (!row || !isOwner(request.cookies, row.id, row.ownerTokenHash)) {
    return { response: NextResponse.json({ error: 'Only the person who ran this analysis can change it' }, { status: 403 }) }
  }
  return { row }
}
