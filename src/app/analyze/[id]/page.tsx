'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProgressTracker } from '@/components/progress-tracker'
import { ResultsDashboard } from '@/components/results-dashboard'
import { BrandReport } from '@/lib/extractors/types'

// BrandLens Logo Icon Component (matching homepage)
function BrandLensIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lens-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="10" stroke="url(#lens-gradient)" strokeWidth="2.5" fill="none" />
      <circle cx="14" cy="14" r="6" stroke="url(#lens-gradient)" strokeWidth="1.5" fill="none" opacity="0.6" />
      <line x1="21.5" y1="21.5" x2="28" y2="28" stroke="url(#lens-gradient)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2" fill="url(#lens-gradient)" opacity="0.4" />
    </svg>
  )
}

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
      <div className="min-h-screen animated-gradient-bg flex items-center justify-center">
        <div className="text-center animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BrandLensIcon className="w-10 h-10" />
            <h1 className="text-3xl font-bold text-slate-900">BrandLens</h1>
          </div>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (status === 'error' || status === 'failed') {
    return (
      <div className="min-h-screen animated-gradient-bg flex items-center justify-center p-4">
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-6">
            <BrandLensIcon className="w-10 h-10" />
            <h1 className="text-3xl font-bold text-slate-900">BrandLens</h1>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-lg card-enhanced p-8 max-w-md w-full text-center animate-fade-in-up-delay-1">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Analysis Failed</h2>
          <p className="text-slate-600 mb-6">{error || 'An error occurred during analysis.'}</p>
          <Link href="/">
            <Button className="btn-hover-lift bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600">
              Try Again
            </Button>
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
    <div className="min-h-screen animated-gradient-bg flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8 animate-fade-in-up">
        <div className="flex items-center justify-center gap-3 mb-3">
          <BrandLensIcon className="w-10 h-10" />
          <h1 className="text-3xl font-bold text-slate-900">BrandLens</h1>
        </div>
        <p className="text-slate-600">Analyzing your brand...</p>
      </div>

      <div className="animate-fade-in-up-delay-1">
        <ProgressTracker
          status={status}
          step={progress?.step}
          currentUrl={progress?.currentUrl}
          pagesProcessed={progress?.pagesProcessed}
        />
      </div>

      <div className="mt-8 animate-fade-in-up-delay-2">
        <Link href="/">
          <Button variant="ghost" className="text-slate-500 hover:text-slate-700">
            Cancel
          </Button>
        </Link>
      </div>
    </div>
  )
}
