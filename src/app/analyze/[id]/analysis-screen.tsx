'use client'

import Link from 'next/link'
import { AlertTriangle, SearchX, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLensWordmark } from '@/components/brand-lens-logo'
import { ProgressTracker } from '@/components/progress-tracker'
import { ReportView } from '@/components/report/report-view'
import { useReportPoller } from '@/lib/client/use-report-poller'

function CenteredScreen({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="animated-gradient-bg flex min-h-screen flex-col items-center justify-center gap-8 p-4">
      <BrandLensWordmark />
      {children}
    </main>
  )
}

function Problem({
  icon,
  title,
  message,
  action,
}: {
  icon: React.ReactNode
  title: string
  message: string
  action: React.ReactNode
}) {
  return (
    <div role="alert" className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-slate-100 text-slate-700" aria-hidden>
        {icon}
      </div>
      <h1 className="mb-2 text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mb-6 text-slate-700">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">{action}</div>
    </div>
  )
}

export function AnalysisScreen({ id }: { id: string }) {
  const { phase, view, retries, error, poller } = useReportPoller(id)

  if (phase === 'completed' && view?.report) {
    return <ReportView view={view} context="live" onViewChange={next => poller.setView(next)} />
  }

  if (phase === 'running' && view?.report) {
    return (
      <ReportView
        view={view}
        context="live"
        partial
        banner={
          <div className="mb-6 flex justify-center">
            <ProgressTracker progress={view.progress} status={view.status} retrying={retries > 0} />
          </div>
        }
      />
    )
  }

  if (phase === 'loading' || phase === 'running') {
    return (
      <CenteredScreen>
        <h1 className="sr-only">Analyzing brand</h1>
        {view ? (
          <ProgressTracker progress={view.progress} status={view.status} retrying={retries > 0} />
        ) : (
          <div role="status" className="flex flex-col items-center gap-3 text-slate-700">
            <span className="size-10 rounded-full border-2 border-indigo-200 border-t-indigo-600 motion-safe:animate-spin" aria-hidden />
            {retries > 0 ? 'Having trouble reaching the server. Still trying…' : 'Loading report…'}
          </div>
        )}
        <Button asChild variant="ghost" className="text-slate-700">
          <Link href="/">Back to home</Link>
        </Button>
      </CenteredScreen>
    )
  }

  if (phase === 'failed') {
    return (
      <CenteredScreen>
        <Problem
          icon={<AlertTriangle className="size-7" />}
          title="The analysis didn't finish"
          message={error ?? 'Something went wrong while analyzing this site.'}
          action={
            <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
              <Link href="/">Try another analysis</Link>
            </Button>
          }
        />
      </CenteredScreen>
    )
  }

  if (phase === 'not_found') {
    return (
      <CenteredScreen>
        <Problem
          icon={<SearchX className="size-7" />}
          title="Report not found"
          message="This report doesn't exist or has been deleted. Reports are kept for 30 days."
          action={
            <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
              <Link href="/">Analyze a brand</Link>
            </Button>
          }
        />
      </CenteredScreen>
    )
  }

  return (
    <CenteredScreen>
      <Problem
        icon={<WifiOff className="size-7" />}
        title={phase === 'stalled' ? 'This is taking longer than expected' : "Can't reach BrandLens"}
        message={
          phase === 'stalled'
            ? 'The analysis may still be running. Check again, or come back to this page in a few minutes.'
            : 'Your connection or our server is having trouble. Your analysis keeps running in the meantime.'
        }
        action={
          <>
            <Button onClick={() => poller.retry()} className="bg-indigo-600 text-white hover:bg-indigo-700">
              Check again
            </Button>
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </>
        }
      />
    </CenteredScreen>
  )
}
