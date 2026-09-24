import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createOwnerToken, hashOwnerToken, isOwner } from './ownership'
import { getClientIp } from './client-ip'
import { rejectUnsafeMutation } from './request-guard'

const cookies = (entries: Record<string, string>) => ({
  get: (name: string) => (name in entries ? { name, value: entries[name] } : undefined),
})

describe('owner tokens', () => {
  it('stores only a hash and verifies the matching cookie', () => {
    const { token, hash } = createOwnerToken()
    expect(hash).toBe(hashOwnerToken(token))
    expect(hash).not.toContain(token)
    expect(isOwner(cookies({ 'bl_owner_r1': token }), 'r1', hash)).toBe(true)
  })

  it('rejects a missing, wrong, or other-report token', () => {
    const { token, hash } = createOwnerToken()
    const other = createOwnerToken()
    expect(isOwner(cookies({}), 'r1', hash)).toBe(false)
    expect(isOwner(cookies({ 'bl_owner_r1': other.token }), 'r1', hash)).toBe(false)
    expect(isOwner(cookies({ 'bl_owner_r2': token }), 'r1', hash)).toBe(false)
    expect(isOwner(cookies({ 'bl_owner_r1': token }), 'r1', null)).toBe(false)
  })

  it('does not accept the report id or slug as a token', () => {
    const { hash } = createOwnerToken()
    expect(isOwner(cookies({ 'bl_owner_r1': 'r1' }), 'r1', hash)).toBe(false)
  })
})

describe('getClientIp', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('ignores client-supplied X-Forwarded-For entries left of the trusted proxy', () => {
    // Client sent "1.1.1.1"; a proxy appended the real address
    const headers = new Headers({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' })
    expect(getClientIp(headers)).toBe('203.0.113.9')
  })

  it('respects TRUSTED_PROXY_HOPS', () => {
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2')
    const headers = new Headers({ 'x-forwarded-for': 'spoofed, 198.51.100.4, 10.0.0.2' })
    expect(getClientIp(headers)).toBe('198.51.100.4')
  })

  it('falls back to x-real-ip, then unknown', () => {
    expect(getClientIp(new Headers({ 'x-real-ip': '192.0.2.1' }))).toBe('192.0.2.1')
    expect(getClientIp(new Headers())).toBe('unknown')
  })
})

describe('rejectUnsafeMutation', () => {
  const request = (headers: Record<string, string>) =>
    new NextRequest('https://brandlens.test/api/analyze', { method: 'POST', headers: { host: 'brandlens.test', ...headers } })

  it('allows a same-origin JSON request', () => {
    expect(rejectUnsafeMutation(request({ 'sec-fetch-site': 'same-origin', 'content-type': 'application/json' }))).toBeNull()
  })

  it('blocks cross-site requests, including text/plain form posts', () => {
    expect(rejectUnsafeMutation(request({ 'sec-fetch-site': 'cross-site', 'content-type': 'text/plain' }))?.status).toBe(403)
    expect(rejectUnsafeMutation(request({ origin: 'https://evil.test', 'content-type': 'application/json' }))?.status).toBe(403)
    expect(rejectUnsafeMutation(request({ 'content-type': 'application/json' }))?.status).toBe(403)
  })

  it('requires a JSON body', () => {
    expect(rejectUnsafeMutation(request({ 'sec-fetch-site': 'same-origin', 'content-type': 'text/plain' }))?.status).toBe(415)
    expect(rejectUnsafeMutation(request({ origin: 'https://brandlens.test', 'content-type': 'application/json; charset=utf-8' }))).toBeNull()
  })
})
