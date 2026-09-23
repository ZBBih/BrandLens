'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Usage {
  remaining: { ip: number; global: number }
  resetsAt: string
}

function formatReset(iso: string | undefined) {
  if (!iso) return 'tomorrow'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? 'tomorrow' : `at ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.headers.get('content-type')?.includes('application/json') ? response.json() : {}
}

export function AnalyzeForm() {
  const router = useRouter()
  const inputId = useId()
  const errorId = useId()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [limited, setLimited] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/rate-limit', { cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (!cancelled && data?.remaining) setUsage(data)
      })
      .catch(() => {
        // The counter is informational; the server enforces the limit either way
      })
    return () => {
      cancelled = true
    }
  }, [])

  const remaining = usage ? Math.min(usage.remaining.ip, usage.remaining.global) : null
  const exhausted = remaining === 0

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError(null)
    setLimited(false)

    if (!url.trim()) {
      setError('Enter a website address, like nike.com')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await readJson(response)

      if (!response.ok) {
        if (data.rateLimited) {
          setLimited(true)
          setUsage(current => (current ? { ...current, remaining: { ip: 0, global: current.remaining.global } } : current))
        }
        setError(typeof data.error === 'string' ? data.error : 'The analysis could not be started. Please try again.')
        setSubmitting(false)
        return
      }

      router.push(`/analyze/${encodeURIComponent(String(data.id))}`)
    } catch {
      setError('Could not reach BrandLens. Check your connection and try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-900">
          Website address
        </label>
        <Input
          id={inputId}
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nike.com"
          value={url}
          onChange={event => setUrl(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className="input-focus-glow h-12 text-lg"
          disabled={submitting}
        />
        {error && (
          <div
            id={errorId}
            role="alert"
            className={`flex items-start gap-2 rounded-lg p-3 text-sm ${limited ? 'border border-amber-200 bg-amber-50 text-amber-950' : 'bg-red-50 text-red-800'}`}
          >
            {limited && <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span>{error}</span>
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="btn-hover-lift h-12 w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-lg text-white hover:from-indigo-700 hover:to-violet-700"
        disabled={submitting}
        aria-busy={submitting}
      >
        {submitting ? (
          <>
            <span className="size-5 rounded-full border-2 border-white/40 border-t-white motion-safe:animate-spin" aria-hidden />
            Starting analysis…
          </>
        ) : (
          'Analyze brand'
        )}
      </Button>

      {remaining !== null && (
        <p className="text-center text-sm text-slate-700" aria-live="polite">
          {exhausted
            ? `You've used today's free analyses. More are available ${formatReset(usage?.resetsAt)}. Recently analysed sites still open instantly.`
            : `${remaining} free ${remaining === 1 ? 'analysis' : 'analyses'} left today`}
        </p>
      )}
    </form>
  )
}
