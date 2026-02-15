'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ResultsDashboard } from '@/components/results-dashboard'
import { BrandReport } from '@/lib/extractors/types'

export default function DemoPage() {
  const [report, setReport] = useState<BrandReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDemo() {
      try {
        const response = await fetch('/api/demo')
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load demo')
        }

        setReport(data.report)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load demo')
      } finally {
        setLoading(false)
      }
    }

    loadDemo()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading demo...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Failed to Load Demo</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <Link href="/">
            <Button>Try Your Own URL</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!report) {
    return null
  }

  return (
    <>
      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
              Demo Mode
            </span>
            <span className="text-white/80 text-sm">
              This is a sample report. Try your own URL to see your brand analysis.
            </span>
          </div>
          <Link href="/">
            <Button variant="secondary" size="sm" className="bg-white text-blue-600 hover:bg-white/90">
              Analyze Your Brand
            </Button>
          </Link>
        </div>
      </div>

      <ResultsDashboard report={report} />
    </>
  )
}
