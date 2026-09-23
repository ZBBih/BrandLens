'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BrandLogo } from '@/components/report/logo-section'
import { brandColors } from '@/components/report/hero-section'
import { PLATFORM_NAMES } from '@/components/report/social-icons'
import { useReportPoller } from '@/lib/client/use-report-poller'
import { applyOverrides } from '@/lib/report/overrides'
import { readableTextOn, safeHex } from '@/lib/color-contrast'
import type { BrandReport } from '@/lib/extractors/types'

function PanelMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-700">
      {children}
    </div>
  )
}

function ComparisonCard({ report }: { report: BrandReport }) {
  const { primary } = brandColors(report)
  const onPrimary = readableTextOn(primary)

  return (
    <article aria-label={`${report.brandName} summary`} className="overflow-hidden rounded-2xl border bg-white">
      <div className="p-6" style={{ backgroundColor: primary, color: onPrimary }}>
        <div className="flex items-center gap-4">
          <BrandLogo url={report.logoUrl} alt="" className="h-12 max-w-[6rem] rounded bg-white/90 object-contain p-1" />
          <div className="min-w-0">
            <h2 className="break-words text-xl font-bold">{report.brandName}</h2>
            <p className="truncate text-sm">{report.domain}</p>
          </div>
        </div>
      </div>

      <div className="border-b p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-700">Colours</h3>
        <ul className="flex flex-wrap gap-3">
          {report.colors.colors.slice(0, 5).map((color, i) => (
            <li key={`${color.hex}-${i}`} className="text-center">
              <span className="mb-1 block size-12 rounded-lg ring-1 ring-inset ring-black/10" style={{ backgroundColor: safeHex(color.hex, '#000000') }} aria-hidden />
              <span className="font-mono text-xs text-slate-800">{color.hex.toUpperCase()}</span>
            </li>
          ))}
        </ul>
        {report.colors.colors.length === 0 && <p className="text-sm text-slate-700">No brand colours identified</p>}
      </div>

      <div className="border-b p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-700">Typography</h3>
        {report.typography.fonts.length > 0 ? (
          <ul>
            {report.typography.fonts.slice(0, 3).map(font => (
              <li key={font.name} className="text-slate-900">
                <span className="font-semibold">{font.name}</span> <span className="text-sm text-slate-700">({font.role})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-700">System fonts</p>
        )}
      </div>

      <div className="border-b p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-700">Voice</h3>
        {report.tone.traits.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {report.tone.traits.slice(0, 5).map(trait => (
              <li key={trait} className="rounded-full px-3 py-1 text-sm font-medium" style={{ backgroundColor: primary, color: onPrimary }}>
                {trait}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-700">Not enough copy to analyse</p>
        )}
      </div>

      <div className="p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-700">Channels</h3>
        {report.social.links.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {report.social.links.map(link => (
              <li key={link.url} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-800">
                {PLATFORM_NAMES[link.platform] ?? link.platform}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-700">No social links found</p>
        )}
      </div>
    </article>
  )
}

function BrandPanel({ id }: { id: string }) {
  const { phase, view, poller } = useReportPoller(id)

  if (phase === 'completed' && view?.report) {
    return (
      <div>
        <ComparisonCard report={applyOverrides(view.report, view.overrides)} />
        <Link href={`/analyze/${encodeURIComponent(id)}`} className="mt-3 inline-block text-sm font-medium text-indigo-700 underline-offset-4 hover:underline">
          Open full report
        </Link>
      </div>
    )
  }
  if (phase === 'failed') return <PanelMessage><p role="alert">{view?.error ?? 'This analysis failed.'}</p></PanelMessage>
  if (phase === 'not_found') return <PanelMessage><p role="alert">This report no longer exists.</p></PanelMessage>
  if (phase === 'unreachable' || phase === 'stalled') {
    return (
      <PanelMessage>
        <p role="alert">{phase === 'stalled' ? 'This analysis is taking longer than expected.' : "Can't reach the server right now."}</p>
        <Button variant="outline" onClick={() => poller.retry()}>Check again</Button>
      </PanelMessage>
    )
  }

  return (
    <PanelMessage>
      <span className="size-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 motion-safe:animate-spin" aria-hidden />
      <p role="status">{view?.progress ? `${view.progress.step} (${Math.round(view.progress.percent)}%)` : 'Loading…'}</p>
    </PanelMessage>
  )
}

function AddBrandForm({ brand1Id }: { brand1Id: string }) {
  const router = useRouter()
  const inputId = useId()
  const errorId = useId()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (!url.trim()) {
      setError('Enter a website address to compare with')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {}
      if (!response.ok || !data.id) {
        setError(data.error ?? 'The analysis could not be started. Please try again.')
        return
      }
      router.replace(`/compare?brand1=${encodeURIComponent(brand1Id)}&brand2=${encodeURIComponent(data.id)}`)
    } catch {
      setError('Could not reach BrandLens. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mb-8 rounded-2xl border bg-white p-6">
      <label htmlFor={inputId} className="mb-3 block font-semibold text-slate-900">
        Add a brand to compare
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          id={inputId}
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="competitor.com"
          value={url}
          onChange={event => setUrl(event.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          disabled={submitting}
          className="h-10 flex-1"
        />
        <Button type="submit" disabled={submitting} aria-busy={submitting} className="h-10 bg-indigo-600 text-white hover:bg-indigo-700">
          {submitting ? 'Starting…' : 'Analyze & compare'}
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </form>
  )
}

export function CompareScreen() {
  const searchParams = useSearchParams()
  const brand1Id = searchParams.get('brand1')
  const brand2Id = searchParams.get('brand2')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Brand comparison</h1>
            <p className="text-slate-700">Compare brand guidelines side by side</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">New analysis</Link>
          </Button>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {!brand1Id ? (
          <PanelMessage>
            <p>Pick a report to compare from first.</p>
            <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
              <Link href="/">Analyze a brand</Link>
            </Button>
          </PanelMessage>
        ) : (
          <>
            {!brand2Id && <AddBrandForm brand1Id={brand1Id} />}
            <div className="grid gap-8 md:grid-cols-2">
              <BrandPanel key={brand1Id} id={brand1Id} />
              {brand2Id ? (
                <BrandPanel key={brand2Id} id={brand2Id} />
              ) : (
                <PanelMessage>
                  <p className="text-lg">Add another brand to compare</p>
                </PanelMessage>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
