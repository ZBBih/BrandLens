'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type CopyStatus = 'idle' | 'copied' | 'failed'

/**
 * Copy text to the clipboard with an explicit result (A37). Clipboard writes
 * reject when permission is denied or the page is not in a secure context.
 */
export function useCopy(resetMs = 2000) {
  const [status, setStatus] = useState<CopyStatus>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const copy = useCallback(
    async (text: string) => {
      if (timer.current) clearTimeout(timer.current)
      try {
        await navigator.clipboard.writeText(text)
        setStatus('copied')
      } catch {
        setStatus('failed')
      }
      timer.current = setTimeout(() => setStatus('idle'), resetMs)
    },
    [resetMs]
  )

  return { status, copy }
}
