/**
 * Report persistence: creation, cloning, views, stale-job detection, retention
 */

import { randomBytes } from 'node:crypto'
import type { Report } from '@prisma/client'
import { prisma } from '../db'
import type { BrandReport } from '../extractors/types'
import type { JobProgress, JobStatus } from '../jobs/analyze'
import { createOwnerToken, isOwner } from './ownership'
import { applyOverrides } from './overrides'
import type { ReportOverrides, ReportView } from './types'

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000
/** A running job bumps heartbeatAt every few seconds; silence this long means it died */
export const STALE_JOB_MS = 90 * 1000
export const MAX_REGENERATIONS = 3

const PRIVATE_RETENTION_DAYS = 30
const PUBLIC_RETENTION_DAYS = 180

const TERMINAL_STATUSES: JobStatus[] = ['completed', 'failed']
const INTERRUPTED_MESSAGE = 'This analysis stopped unexpectedly. Please run it again.'

type CookieReader = Parameters<typeof isOwner>[0]

/**
 * URL-friendly slug with 40 bits of randomness (A47)
 */
export function generateSlug(domain: string): string {
  const now = new Date()
  const baseName = domain
    .replace(/\.[a-z]{2,}$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'brand'
  const suffix = randomBytes(5).toString('hex')
  return `${baseName}-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${suffix}`
}

function parseJson<T>(value: string | null): T | undefined {
  if (!value) return undefined
  try {
    return JSON.parse(value) as T
  } catch {
    return undefined
  }
}

/**
 * Create a queued report owned by the caller. Returns the raw owner token,
 * which the route hands to the client only as an httpOnly cookie.
 */
export async function createOwnedReport(domain: string): Promise<{ id: string; ownerToken: string }> {
  const { token, hash } = createOwnerToken()
  const report = await prisma.report.create({
    data: {
      domain,
      status: 'queued',
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      heartbeatAt: new Date(),
      slug: generateSlug(domain),
      ownerTokenHash: hash,
    },
    select: { id: true },
  })
  return { id: report.id, ownerToken: token }
}

/**
 * A completed, unexpired original analysis of this domain, if any
 */
export async function findCachedSource(domain: string): Promise<Report | null> {
  return prisma.report.findFirst({
    where: { domain, status: 'completed', sourceReportId: null, expiresAt: { gt: new Date() }, data: { not: null } },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * A live job already analysing this domain, if any (A21)
 */
export async function findInFlight(domain: string): Promise<{ id: string } | null> {
  return prisma.report.findFirst({
    where: {
      domain,
      status: { notIn: TERMINAL_STATUSES },
      heartbeatAt: { gt: new Date(Date.now() - STALE_JOB_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
}

/**
 * Give the requester their own copy of a cached report: no crawl, no quota,
 * and edits or sharing on the copy never affect anyone else's report.
 */
export async function cloneForRequester(source: Report): Promise<{ id: string; ownerToken: string }> {
  const { token, hash } = createOwnerToken()
  const clone = await prisma.report.create({
    data: {
      domain: source.domain,
      status: 'completed',
      data: source.data,
      completedAt: source.completedAt,
      expiresAt: source.expiresAt,
      heartbeatAt: source.heartbeatAt,
      slug: generateSlug(source.domain),
      ownerTokenHash: hash,
      sourceReportId: source.id,
    },
    select: { id: true },
  })
  return { id: clone.id, ownerToken: token }
}

/**
 * Mark a job failed if its heartbeat has gone silent. Safe to call from any
 * request; the conditional update means only one caller wins.
 */
async function reapIfStale(report: Report): Promise<Report> {
  if (TERMINAL_STATUSES.includes(report.status as JobStatus)) return report
  const lastSeen = (report.heartbeatAt ?? report.createdAt).getTime()
  if (Date.now() - lastSeen < STALE_JOB_MS) return report

  await prisma.report.updateMany({
    where: { id: report.id, status: report.status, heartbeatAt: report.heartbeatAt },
    data: { status: 'failed', error: INTERRUPTED_MESSAGE },
  })
  return { ...report, status: 'failed', error: INTERRUPTED_MESSAGE }
}

/**
 * The report as a given requester may see it.
 *
 * Owners receive the unedited report plus their overrides so the editor knows
 * the original values; everyone else receives the report with edits applied.
 * Clients always render applyOverrides(view.report, view.overrides).
 */
export function toView(row: Report, cookies: CookieReader | null): ReportView {
  const owner = cookies ? isOwner(cookies, row.id, row.ownerTokenHash) : false
  const overrides = parseJson<ReportOverrides>(row.overrides)
  const data = parseJson<BrandReport>(row.data)
  const visible = owner || row.isPublic

  const report = data
    ? {
        ...(owner ? data : applyOverrides(data, overrides)),
        id: row.id,
        slug: visible ? row.slug : undefined,
        isPublic: row.isPublic,
        cached: !!row.sourceReportId,
      }
    : undefined

  return {
    id: row.id,
    status: row.status as JobStatus,
    progress: parseJson<JobProgress>(row.progress),
    report,
    error: row.error ?? undefined,
    isOwner: owner,
    isPublic: row.isPublic,
    sharePath: visible ? `/report/${row.slug}` : undefined,
    overrides: owner ? overrides : undefined,
    regenerationsLeft: Math.max(0, MAX_REGENERATIONS - row.assetsRegenerateCount),
    cachedFrom: row.sourceReportId ? (data?.generatedAt ?? row.completedAt?.toISOString()) : undefined,
  }
}

export async function getReportRow(id: string): Promise<Report | null> {
  const row = await prisma.report.findUnique({ where: { id } })
  return row ? reapIfStale(row) : null
}

export async function getReportView(id: string, cookies: CookieReader | null): Promise<ReportView | null> {
  const row = await getReportRow(id)
  return row ? toView(row, cookies) : null
}

/**
 * Public report by slug, with owner edits applied. Null unless public and completed.
 */
export async function getPublicReport(slug: string): Promise<BrandReport | null> {
  const row = await prisma.report.findUnique({ where: { slug } })
  if (!row || !row.isPublic || row.status !== 'completed') return null
  const view = toView(row, null)
  return view.report ? applyOverrides(view.report, view.overrides) : null
}

export async function countPublicView(slug: string): Promise<void> {
  await prisma.report.updateMany({ where: { slug, isPublic: true }, data: { publicViews: { increment: 1 } } })
}

/**
 * Delete reports past their retention period (A48, G19)
 */
export async function sweepExpiredReports(): Promise<number> {
  const day = 24 * 60 * 60 * 1000
  const { count } = await prisma.report.deleteMany({
    where: {
      OR: [
        { isPublic: false, createdAt: { lt: new Date(Date.now() - PRIVATE_RETENTION_DAYS * day) } },
        { isPublic: true, createdAt: { lt: new Date(Date.now() - PUBLIC_RETENTION_DAYS * day) } },
      ],
    },
  })
  return count
}

export const RETENTION = { privateDays: PRIVATE_RETENTION_DAYS, publicDays: PUBLIC_RETENTION_DAYS }
