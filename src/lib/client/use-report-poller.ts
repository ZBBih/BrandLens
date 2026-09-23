'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { ReportPoller } from './report-poller'

/**
 * Subscribe to a report's status until it completes or fails
 */
export function useReportPoller(id: string) {
  const [poller] = useState(() => new ReportPoller(id))

  useEffect(() => {
    poller.start()
    return () => poller.stop()
  }, [poller])

  const state = useSyncExternalStore(poller.subscribe, poller.getSnapshot, poller.getSnapshot)
  return { ...state, poller }
}
