/**
 * Request guards for state-changing API routes
 *
 * JSON-only bodies plus a same-origin check stop cross-site form posts
 * (text/plain bodies need no CORS preflight) from spending a visitor's quota
 * or triggering LLM calls on their behalf (G11).
 */

import { NextRequest, NextResponse } from 'next/server'

function requestHost(request: NextRequest): string | null {
  return request.headers.get('x-forwarded-host') ?? request.headers.get('host')
}

function isSameOrigin(request: NextRequest): boolean {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite) {
    return fetchSite === 'same-origin' || fetchSite === 'none'
  }

  // Older browsers: fall back to comparing the Origin header with our host
  const origin = request.headers.get('origin')
  if (!origin) return false
  try {
    return new URL(origin).host === requestHost(request)
  } catch {
    return false
  }
}

/**
 * Returns an error response when a mutation request is not a same-origin JSON
 * request, or null when it may proceed.
 */
export function rejectUnsafeMutation(request: NextRequest, { requireJson = true } = {}): NextResponse | null {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-site requests are not allowed' }, { status: 403 })
  }
  if (requireJson) {
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().startsWith('application/json')) {
      return NextResponse.json({ error: 'Expected a JSON request body' }, { status: 415 })
    }
  }
  return null
}

/**
 * Parse a JSON body without throwing on malformed input
 */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return undefined
  }
}
