/**
 * Polls /api/status/[id] until a report finishes (A12, A13)
 *
 * - One request in flight at a time; the next poll is scheduled only after the
 *   previous one settles, so responses can never arrive out of order.
 * - Transient failures (network errors, 5xx, non-JSON bodies) are retried with
 *   backoff before the UI is told anything went wrong.
 * - Gives up with a "stalled" state after a hard ceiling instead of spinning forever.
 *
 * Exposed as an external store for useSyncExternalStore, so React components
 * never set state from inside an effect.
 */

import type { ReportView } from '../report/types'

export type PollPhase = 'loading' | 'running' | 'completed' | 'failed' | 'not_found' | 'unreachable' | 'stalled'

export interface PollState {
  phase: PollPhase
  view: ReportView | null
  /** Consecutive failed attempts; > 0 while retrying */
  retries: number
  error?: string
}

const POLL_INTERVAL_MS = 2000
const MAX_RETRIES = 4
const MAX_DURATION_MS = 6 * 60 * 1000

export class ReportPoller {
  private state: PollState = { phase: 'loading', view: null, retries: 0 }
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private controller: AbortController | null = null
  private startedAt = 0
  private active = false

  constructor(private readonly id: string) {}

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.state

  /** Replace the view after a local mutation (edit, share, regenerate) */
  setView(view: ReportView) {
    this.update({ view })
  }

  start() {
    if (this.active) return
    this.active = true
    this.startedAt = Date.now()
    this.schedule(0)
  }

  stop() {
    this.active = false
    if (this.timer) clearTimeout(this.timer)
    this.controller?.abort()
    this.timer = null
    this.controller = null
  }

  /** Try again after the poller gave up */
  retry() {
    this.stop()
    this.update({ phase: this.state.view ? 'running' : 'loading', retries: 0, error: undefined })
    this.start()
  }

  private update(patch: Partial<PollState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }

  private schedule(delay: number) {
    if (!this.active) return
    this.timer = setTimeout(() => void this.tick(), delay)
  }

  private async tick() {
    if (!this.active) return
    if (Date.now() - this.startedAt > MAX_DURATION_MS) {
      this.stop()
      this.update({ phase: 'stalled' })
      return
    }

    this.controller = new AbortController()
    try {
      const response = await fetch(`/api/status/${encodeURIComponent(this.id)}`, {
        signal: this.controller.signal,
        cache: 'no-store',
      })

      if (response.status === 404) {
        this.stop()
        this.update({ phase: 'not_found', retries: 0 })
        return
      }

      const isJson = response.headers.get('content-type')?.includes('application/json')
      if (!response.ok || !isJson) throw new Error(`HTTP ${response.status}`)

      const view = (await response.json()) as ReportView
      if (!this.active) return

      if (view.status === 'completed') {
        this.stop()
        this.update({ phase: 'completed', view, retries: 0, error: undefined })
      } else if (view.status === 'failed') {
        this.stop()
        this.update({ phase: 'failed', view, retries: 0, error: view.error })
      } else {
        this.update({ phase: 'running', view, retries: 0, error: undefined })
        this.schedule(POLL_INTERVAL_MS)
      }
    } catch (error) {
      if (!this.active || (error instanceof DOMException && error.name === 'AbortError')) return
      const retries = this.state.retries + 1
      if (retries > MAX_RETRIES) {
        this.stop()
        this.update({ phase: 'unreachable', retries })
        return
      }
      this.update({ retries })
      this.schedule(Math.min(POLL_INTERVAL_MS * 2 ** retries, 15_000))
    }
  }
}
