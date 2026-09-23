import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReportPoller } from './report-poller'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const view = (status: string) => ({ id: 'r1', status, isOwner: true, isPublic: false, regenerationsLeft: 3 })

describe('ReportPoller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('polls until completed, then stops', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(view('crawling')))
      .mockResolvedValueOnce(json(view('analyzing')))
      .mockResolvedValueOnce(json(view('completed')))
    vi.stubGlobal('fetch', fetchMock)

    const poller = new ReportPoller('r1')
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(poller.getSnapshot().phase).toBe('running')
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)
    expect(poller.getSnapshot().phase).toBe('completed')

    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retries a transient failure instead of reporting the job as failed', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(new Response('<html>502</html>', { status: 502, headers: { 'content-type': 'text/html' } }))
      .mockResolvedValueOnce(json(view('completed')))
    vi.stubGlobal('fetch', fetchMock)

    const poller = new ReportPoller('r1')
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(poller.getSnapshot()).toMatchObject({ phase: 'loading', retries: 1 })
    await vi.advanceTimersByTimeAsync(20_000)
    expect(poller.getSnapshot().phase).toBe('completed')
  })

  it('never has two requests in flight', async () => {
    let inFlight = 0
    let maxInFlight = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(resolve => setTimeout(resolve, 5000)) // slower than the poll interval
      inFlight--
      return json(view('crawling'))
    }))

    const poller = new ReportPoller('r1')
    poller.start()
    await vi.advanceTimersByTimeAsync(30_000)
    poller.stop()
    expect(maxInFlight).toBe(1)
  })

  it('gives up as unreachable after repeated failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    const poller = new ReportPoller('r1')
    poller.start()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(poller.getSnapshot().phase).toBe('unreachable')
  })

  it('reports stalled after the time ceiling', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(view('crawling'))))
    const poller = new ReportPoller('r1')
    poller.start()
    await vi.advanceTimersByTimeAsync(7 * 60 * 1000)
    expect(poller.getSnapshot().phase).toBe('stalled')
  })

  it('reports not_found on 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'Report not found' }, 404)))
    const poller = new ReportPoller('r1')
    poller.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(poller.getSnapshot().phase).toBe('not_found')
  })
})
