/**
 * POST /api/dev/clear-cache
 * Clear local development cache
 * Only works in development mode
 */

import { NextResponse } from 'next/server'
import { clearLocalCache } from '@/lib/dev/local-cache'

export async function POST() {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Dev routes only available in development mode' },
      { status: 403 }
    )
  }

  clearLocalCache()

  return NextResponse.json({
    success: true,
    message: 'Local cache cleared',
  })
}
