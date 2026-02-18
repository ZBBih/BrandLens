/**
 * GET /api/health
 * Simple health check endpoint to verify deployment
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
  const keyPrefix = process.env.ANTHROPIC_API_KEY?.substring(0, 10) || 'not set'

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: 'v3-debug',
    config: {
      anthropicKeyConfigured: hasAnthropicKey,
      keyPrefix: hasAnthropicKey ? keyPrefix + '...' : 'not set',
      databaseUrl: !!process.env.DATABASE_URL,
    }
  })
}
