/**
 * Durable daily quotas backed by Postgres
 *
 * Each quota is a (key, UTC day) counter incremented with a conditional upsert,
 * so the check and the increment are one atomic statement: concurrent requests
 * cannot all pass a check before any of them is recorded (A5). Counters survive
 * restarts and deploys, and are shared by every app instance.
 */

import { prisma } from './db'

export const PER_IP_DAILY_LIMIT = 3
export const GLOBAL_DAILY_LIMIT = 50
export const PDF_PER_IP_DAILY_LIMIT = 30

export interface Quota {
  key: string
  limit: number
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** Next UTC midnight, when every daily counter resets */
export function nextResetAt(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
}

class QuotaExceeded extends Error {
  constructor(public readonly key: string) {
    super(`Quota exceeded: ${key}`)
  }
}

/**
 * Atomically consume one unit from every quota, or none of them.
 * Returns the key of the first exhausted quota when refused.
 */
export async function consumeQuotas(quotas: Quota[]): Promise<{ allowed: true } | { allowed: false; exhausted: string }> {
  const day = todayUtc()
  try {
    await prisma.$transaction(async tx => {
      for (const { key, limit } of quotas) {
        const rows = await tx.$queryRaw<{ count: number }[]>`
          INSERT INTO "RateLimitCounter" ("key", "day", "count")
          VALUES (${key}, ${day}, 1)
          ON CONFLICT ("key", "day") DO UPDATE
            SET "count" = "RateLimitCounter"."count" + 1
            WHERE "RateLimitCounter"."count" < ${limit}
          RETURNING "count"`
        // No row returned means the WHERE guard refused the increment
        if (rows.length === 0) throw new QuotaExceeded(key)
      }
    })
    return { allowed: true }
  } catch (error) {
    if (error instanceof QuotaExceeded) return { allowed: false, exhausted: error.key }
    throw error
  }
}

/**
 * Give a unit back, e.g. when the work it paid for could not start
 */
export async function refundQuotas(keys: string[]): Promise<void> {
  const day = todayUtc()
  await prisma.rateLimitCounter.updateMany({
    where: { key: { in: keys }, day, count: { gt: 0 } },
    data: { count: { decrement: 1 } },
  })
}

export async function getCounts(keys: string[]): Promise<Record<string, number>> {
  const rows = await prisma.rateLimitCounter.findMany({ where: { key: { in: keys }, day: todayUtc() } })
  const counts: Record<string, number> = Object.fromEntries(keys.map(key => [key, 0]))
  for (const row of rows) counts[row.key] = row.count
  return counts
}

export const analyzeQuotas = (ip: string): Quota[] => [
  { key: 'analyze:global', limit: GLOBAL_DAILY_LIMIT },
  { key: `analyze:ip:${ip}`, limit: PER_IP_DAILY_LIMIT },
]

export async function getAnalyzeUsage(ip: string) {
  const counts = await getCounts(['analyze:global', `analyze:ip:${ip}`])
  return {
    remaining: {
      ip: Math.max(0, PER_IP_DAILY_LIMIT - counts[`analyze:ip:${ip}`]),
      global: Math.max(0, GLOBAL_DAILY_LIMIT - counts['analyze:global']),
    },
    limits: { perIp: PER_IP_DAILY_LIMIT, global: GLOBAL_DAILY_LIMIT },
    resetsAt: nextResetAt().toISOString(),
  }
}

/**
 * Delete counters older than a week (called from the retention sweep)
 */
export async function pruneCounters(): Promise<number> {
  const cutoff = todayUtc(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
  const { count } = await prisma.rateLimitCounter.deleteMany({ where: { day: { lt: cutoff } } })
  return count
}
