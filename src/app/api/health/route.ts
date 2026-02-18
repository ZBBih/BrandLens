/**
 * GET /api/health
 * Simple health check endpoint to verify deployment
 */

import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: 'v2-inline-demo',
  })
}
