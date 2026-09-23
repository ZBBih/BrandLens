/**
 * Report ownership via capability tokens
 *
 * The creator of a report receives a random 256-bit token in an httpOnly,
 * SameSite=Lax cookie scoped to that report. Only its SHA-256 hash is stored.
 * The token never appears in a URL, a response body, or client JavaScript, so
 * it cannot leak through Referer headers, logs, or shared links.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

const COOKIE_PREFIX = 'bl_owner_'
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // matches report retention

export function hashOwnerToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createOwnerToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashOwnerToken(token) }
}

function cookieName(reportId: string): string {
  return `${COOKIE_PREFIX}${reportId.replace(/[^a-zA-Z0-9-]/g, '')}`
}

export function setOwnerCookie(response: NextResponse, reportId: string, token: string): void {
  response.cookies.set(cookieName(reportId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })
}

/**
 * Constant-time check that the request carries the owner token for a report
 */
export function isOwner(
  cookies: Pick<NextRequest['cookies'], 'get'>,
  reportId: string,
  ownerTokenHash: string | null
): boolean {
  if (!ownerTokenHash) return false
  const token = cookies.get(cookieName(reportId))?.value
  if (!token) return false

  const expected = Buffer.from(ownerTokenHash, 'hex')
  const actual = Buffer.from(hashOwnerToken(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
