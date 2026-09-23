'use client'

import { useEffect, useState } from 'react'
import { Check, FileText, Globe, Palette, Sparkles, Clock } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import type { JobProgress, JobStatus } from '@/lib/jobs/analyze'

const STEPS: { key: JobStatus; label: string; detail: string; Icon: typeof Globe }[] = [
  { key: 'queued', label: 'Starting', detail: 'Preparing the analysis.', Icon: Clock },
  { key: 'crawling', label: 'Reading site', detail: 'Visiting the homepage and key pages like About and Contact.', Icon: Globe },
  { key: 'extracting', label: 'Extracting', detail: 'Reading colours, fonts, logos, meta tags and structured data.', Icon: Palette },
  { key: 'analyzing', label: 'Voice', detail: 'AI reads the copy to describe the brand voice and positioning.', Icon: Sparkles },
  { key: 'generating', label: 'Writing', detail: 'Drafting marketing copy and strategic insights.', Icon: FileText },
]

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

function useElapsedSeconds(startedAt?: string) {
  const [now, setNow] = useState(() => Date.now())
  const [mountedAt] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const start = startedAt ? Date.parse(startedAt) : mountedAt
  return Math.max(0, Math.floor((now - (Number.isNaN(start) ? mountedAt : start)) / 1000))
}

export function ProgressTracker({ progress, status, retrying }: { progress?: JobProgress; status: JobStatus; retrying: boolean }) {
  const currentIndex = Math.max(0, STEPS.findIndex(step => step.key === status))
  const current = STEPS[currentIndex]
  const percent = Math.max(2, Math.min(99, progress?.percent ?? (currentIndex / STEPS.length) * 100))
  const elapsed = useElapsedSeconds(progress?.startedAt)

  return (
    <section aria-labelledby="progress-heading" className="w-full max-w-2xl rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="progress-heading" className="text-xl font-semibold text-slate-900">
          Analysing brand…
        </h2>
        <p className="text-sm tabular-nums text-slate-700">
          <span className="sr-only">Elapsed time: </span>
          {formatElapsed(elapsed)}
        </p>
      </div>

      <Progress value={percent} aria-label="Analysis progress" aria-valuetext={`${Math.round(percent)} percent`} className="h-2" />

      {/* Only the step text is announced, and only when it changes */}
      <p role="status" className="mt-3 min-h-5 text-sm font-medium text-slate-800">
        {progress?.step ?? current.detail}
      </p>

      <ol className="mt-6 grid grid-cols-5 gap-2">
        {STEPS.map((step, index) => {
          const done = index < currentIndex
          const active = index === currentIndex
          return (
            <li key={step.key} aria-current={active ? 'step' : undefined} className="flex flex-col items-center text-center">
              <span
                className={`flex size-10 items-center justify-center rounded-full ${
                  done ? 'bg-indigo-600 text-white' : active ? 'bg-indigo-100 text-indigo-800 ring-2 ring-indigo-600' : 'bg-slate-100 text-slate-500'
                }`}
                aria-hidden
              >
                {done ? <Check className="size-5" /> : <step.Icon className="size-5" />}
              </span>
              <span className="mt-2 text-xs font-medium text-slate-800">{step.label}</span>
              <span className="sr-only">{done ? '(done)' : active ? '(in progress)' : '(not started)'}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-6 rounded-lg bg-indigo-50 p-4 text-sm text-indigo-950">
        <p className="font-semibold">{current.label}</p>
        <p className="mt-1">{current.detail}</p>
      </div>

      {status === 'crawling' && (progress?.currentUrl || progress?.pagesProcessed !== undefined) && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-800">
          {progress?.currentUrl && (
            <p className="truncate">
              <span className="font-medium">Current page:</span> <span className="font-mono text-xs">{progress.currentUrl}</span>
            </p>
          )}
          {progress?.pagesProcessed !== undefined && (
            <p className="mt-1">
              <span className="font-medium">Pages read:</span> {progress.pagesProcessed}
            </p>
          )}
        </div>
      )}

      {retrying && (
        <p className="mt-4 text-sm text-amber-900">Having trouble reaching the server. Still trying…</p>
      )}

      <p className="mt-6 text-center text-sm text-slate-700">Most sites take one to two minutes. Colours and fonts appear below as soon as they&apos;re ready.</p>
    </section>
  )
}
