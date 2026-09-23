/**
 * GET /api/health
 * Liveness check. Reports nothing about configuration or secrets (A46).
 */

import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })
}
