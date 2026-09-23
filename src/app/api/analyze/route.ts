/**
 * POST /api/analyze
 * Start a brand analysis, reuse a recent one, or join one already running
 */

import { NextRequest, NextResponse } from 'next/server'
import { validatePublicUrl, getDomainName } from '@/lib/utils/url'
import { runAnalysis } from '@/lib/jobs/analyze'
import { analyzeQuotas, consumeQuotas, getAnalyzeUsage } from '@/lib/rate-limit'
import { getClientIp } from '@/lib/report/client-ip'
import { readJson, rejectUnsafeMutation } from '@/lib/report/request-guard'
import { setOwnerCookie } from '@/lib/report/ownership'
import { log } from '@/lib/log'
import { cloneForRequester, createOwnedReport, findCachedSource, findInFlight } from '@/lib/report/store'

export async function POST(request: NextRequest) {
  const rejected = rejectUnsafeMutation(request)
  if (rejected) return rejected

  const body = await readJson(request)
  const input = typeof body === 'object' && body !== null ? (body as { url?: unknown }).url : undefined
  if (typeof input !== 'string' || !input.trim() || input.length > 2048) {
    return NextResponse.json({ error: 'Enter a website address, like nike.com' }, { status: 400 })
  }

  try {
    const validation = await validatePublicUrl(input)
    if (!validation.valid || !validation.url) {
      return NextResponse.json({ error: validation.error ?? 'That address cannot be analysed' }, { status: 400 })
    }

    const url = validation.url
    const domain = getDomainName(url)

    // A recent analysis of this site: give the requester their own copy, free
    const cached = await findCachedSource(domain)
    if (cached) {
      const clone = await cloneForRequester(cached)
      const response = NextResponse.json({ id: clone.id, status: 'completed', cached: true })
      setOwnerCookie(response, clone.id, clone.ownerToken)
      return response
    }

    // Someone is analysing this site right now: follow along instead of re-crawling
    const inFlight = await findInFlight(domain)
    if (inFlight) {
      return NextResponse.json({ id: inFlight.id, status: 'running', joined: true })
    }

    const ip = getClientIp(request.headers)
    const quota = await consumeQuotas(analyzeQuotas(ip))
    if (!quota.allowed) {
      const usage = await getAnalyzeUsage(ip)
      const error =
        quota.exhausted === 'analyze:global'
          ? 'BrandLens has reached its daily analysis limit. It resets at midnight UTC.'
          : `You've used your ${usage.limits.perIp} free analyses for today. They reset at midnight UTC.`
      return NextResponse.json({ error, rateLimited: true, ...usage }, { status: 429 })
    }

    const { id, ownerToken } = await createOwnedReport(domain)

    // Railway runs a long-lived Node server, so the job continues after the
    // response; the heartbeat lets any request detect a job that died.
    void runAnalysis(id, url)

    const usage = await getAnalyzeUsage(ip)
    const response = NextResponse.json({ id, status: 'queued', cached: false, remaining: usage.remaining })
    setOwnerCookie(response, id, ownerToken)
    return response
  } catch (error) {
    log.error('api.analyze_failed', error)
    return NextResponse.json({ error: 'Could not start the analysis. Please try again.' }, { status: 500 })
  }
}
