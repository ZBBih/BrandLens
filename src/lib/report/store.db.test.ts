/**
 * Database tests. Run against a disposable Postgres:
 *   TEST_DATABASE_URL=postgresql://... pnpm test
 * Skipped when TEST_DATABASE_URL is not set.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('database-backed access and quotas', () => {
  let prisma: typeof import('../db').prisma
  let rateLimit: typeof import('../rate-limit')
  let store: typeof import('./store')
  let ownership: typeof import('./ownership')

  beforeAll(async () => {
    process.env.DATABASE_URL = url
    prisma = (await import('../db')).prisma
    rateLimit = await import('../rate-limit')
    store = await import('./store')
    ownership = await import('./ownership')
  })

  beforeEach(async () => {
    await prisma.rateLimitCounter.deleteMany()
    await prisma.report.deleteMany()
  })

  it('never lets concurrent requests exceed the per-IP quota', async () => {
    const attempts = await Promise.all(Array.from({ length: 20 }, () => rateLimit.consumeQuotas(rateLimit.analyzeQuotas('198.51.100.7'))))
    expect(attempts.filter(a => a.allowed)).toHaveLength(rateLimit.PER_IP_DAILY_LIMIT)
    const counts = await rateLimit.getCounts(['analyze:global', 'analyze:ip:198.51.100.7'])
    // Refused attempts roll back their global increment too
    expect(counts['analyze:global']).toBe(rateLimit.PER_IP_DAILY_LIMIT)
    expect(counts['analyze:ip:198.51.100.7']).toBe(rateLimit.PER_IP_DAILY_LIMIT)
  })

  it('refunds a quota unit', async () => {
    await rateLimit.consumeQuotas(rateLimit.analyzeQuotas('192.0.2.5'))
    await rateLimit.refundQuotas(['analyze:ip:192.0.2.5'])
    const usage = await rateLimit.getAnalyzeUsage('192.0.2.5')
    expect(usage.remaining.ip).toBe(rateLimit.PER_IP_DAILY_LIMIT)
  })

  it('gives each requester of a cached report their own owned copy', async () => {
    const source = await prisma.report.create({
      data: {
        domain: 'example.com',
        status: 'completed',
        data: JSON.stringify({ id: 'x', brandName: 'Example', colors: { colors: [] }, typography: { fonts: [] }, summary: { name: 'Example' } }),
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        slug: 'example-src',
      },
    })
    expect((await store.findCachedSource('example.com'))?.id).toBe(source.id)

    const clone = await store.cloneForRequester(source)
    const row = await prisma.report.findUniqueOrThrow({ where: { id: clone.id } })
    expect(row.sourceReportId).toBe(source.id)
    expect(row.slug).not.toBe(source.slug)

    const cookie = { get: (name: string) => (name === `bl_owner_${clone.id}` ? { name, value: clone.ownerToken } : undefined) }
    expect(store.toView(row, cookie).isOwner).toBe(true)
    expect(store.toView(row, null).isOwner).toBe(false)
    // The clone never becomes a cache source itself
    expect((await store.findCachedSource('example.com'))?.id).toBe(source.id)
  })

  it('marks a job whose heartbeat went silent as failed', async () => {
    const { hash } = ownership.createOwnerToken()
    const row = await prisma.report.create({
      data: {
        domain: 'stale.com',
        status: 'crawling',
        expiresAt: new Date(),
        heartbeatAt: new Date(Date.now() - store.STALE_JOB_MS - 1000),
        slug: 'stale',
        ownerTokenHash: hash,
      },
    })
    const view = await store.getReportView(row.id, null)
    expect(view?.status).toBe('failed')
    expect(view?.error).toMatch(/stopped unexpectedly/)
    expect(await store.findInFlight('stale.com')).toBeNull()
  })

  it('hides the share path and overrides from non-owners of a private report', async () => {
    const { token, hash } = ownership.createOwnerToken()
    const row = await prisma.report.create({
      data: {
        domain: 'private.com',
        status: 'completed',
        data: JSON.stringify({ id: 'p', brandName: 'Private', colors: { colors: [] }, typography: { fonts: [] }, summary: { name: 'Private' } }),
        overrides: JSON.stringify({ brandName: 'Renamed' }),
        expiresAt: new Date(),
        slug: 'private-slug',
        ownerTokenHash: hash,
      },
    })
    const stranger = store.toView(row, null)
    expect(stranger.sharePath).toBeUndefined()
    expect(stranger.overrides).toBeUndefined()
    expect(stranger.report?.slug).toBeUndefined()
    expect(stranger.report?.brandName).toBe('Renamed')

    const owner = store.toView(row, { get: (name: string) => (name === `bl_owner_${row.id}` ? { name, value: token } : undefined) })
    expect(owner.sharePath).toBe('/report/private-slug')
    expect(owner.overrides?.brandName).toBe('Renamed')
    expect(await store.getPublicReport('private-slug')).toBeNull()
  })
})
