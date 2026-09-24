/**
 * Server startup hook: schedules the daily retention sweep on self-hosted servers
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  // On Vercel, functions freeze between requests, so timers are unreliable;
  // the daily sweep runs as a Vercel Cron (/api/cron/retention) instead
  if (process.env.VERCEL) return

  const { sweepExpiredReports } = await import('./lib/report/store')
  const { pruneCounters } = await import('./lib/rate-limit')
  const { log } = await import('./lib/log')

  const sweep = async () => {
    try {
      const reports = await sweepExpiredReports()
      const counters = await pruneCounters()
      log.info('retention.swept', { reports, counters })
    } catch (error) {
      log.error('retention.failed', error)
    }
  }

  // First sweep shortly after boot, then daily; unref so it never holds the process open
  setTimeout(sweep, 60_000).unref()
  setInterval(sweep, 24 * 60 * 60 * 1000).unref()
}
