'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProgressTracker } from '@/components/progress-tracker'
import { ResultsDashboard } from '@/components/results-dashboard'
import { BrandReport } from '@/lib/extractors/types'

interface JobProgress {
  status: string
  currentUrl?: string
  pagesProcessed?: number
  step?: string
}

interface StatusResponse {
  status: string
  progress?: JobProgress
  report?: BrandReport
  error?: string
}

export default function AnalyzePage() {
  const params = useParams()
  const id = params.id as string

  const [status, setStatus] = useState<string>('loading')
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [report, setReport] = useState<BrandReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/status/${id}`)
      const data: StatusResponse = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to fetch status')
        setStatus('error')
        return
      }

      setStatus(data.status)
      setProgress(data.progress || null)

      if (data.status === 'completed' && data.report) {
        setReport(data.report)
      }

      if (data.status === 'failed') {
        setError(data.error || 'Analysis failed')
      }
    } catch {
      setError('Failed to connect to server')
      setStatus('error')
    }
  }, [id])

  useEffect(() => {
    fetchStatus()

    // Poll for status updates
    const interval = setInterval(() => {
      if (status !== 'completed' && status !== 'failed' && status !== 'error') {
        fetchStatus()
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [fetchStatus, status])

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (status === 'error' || status === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Analysis Failed</h2>
          <p className="text-slate-600 mb-6">{error || 'An error occurred during analysis.'}</p>
          <Link href="/">
            <Button>Try Again</Button>
          </Link>
        </div>
      </div>
    )
  }

  // Completed state - show results
  if (status === 'completed' && report) {
    return <ResultsDashboard report={report} />
  }

  // In progress state - show progress tracker
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">BrandLens</h1>
        <p className="text-slate-600">Analyzing your brand...</p>
      </div>

      <ProgressTracker
        status={status}
        step={progress?.step}
        currentUrl={progress?.currentUrl}
        pagesProcessed={progress?.pagesProcessed}
      />

      <div className="mt-8">
        <Link href="/">
          <Button variant="ghost" className="text-slate-500">
            Cancel
          </Button>
        </Link>
      </div>
    </div>
  )
}
