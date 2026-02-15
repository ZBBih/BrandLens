'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandReport } from '@/lib/extractors/types'

interface StatusResponse {
  status: string
  report?: BrandReport
  error?: string
}

function CompareContent() {
  const searchParams = useSearchParams()
  const brand1Id = searchParams.get('brand1')
  const brand2Id = searchParams.get('brand2')

  const [brand1, setBrand1] = useState<BrandReport | null>(null)
  const [brand2, setBrand2] = useState<BrandReport | null>(null)
  const [newUrl, setNewUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const fetchReport = useCallback(async (id: string): Promise<BrandReport | null> => {
    try {
      const response = await fetch(`/api/status/${id}`)
      const data: StatusResponse = await response.json()
      if (data.status === 'completed' && data.report) {
        return data.report
      }
    } catch {
      console.error('Failed to fetch report')
    }
    return null
  }, [])

  useEffect(() => {
    if (brand1Id) {
      setLoading(true)
      fetchReport(brand1Id).then(report => {
        setBrand1(report)
        setLoading(false)
      })
    }
    if (brand2Id) {
      fetchReport(brand2Id).then(setBrand2)
    }
  }, [brand1Id, brand2Id, fetchReport])

  const handleAnalyze = async () => {
    if (!newUrl.trim() || !brand1Id) return

    setAnalyzing(true)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl }),
      })
      const data = await response.json()

      if (data.id) {
        // Poll for completion
        const pollForCompletion = async () => {
          const statusRes = await fetch(`/api/status/${data.id}`)
          const statusData: StatusResponse = await statusRes.json()

          if (statusData.status === 'completed' && statusData.report) {
            setBrand2(statusData.report)
            setAnalyzing(false)
            // Update URL with new brand
            window.history.replaceState({}, '', `/compare?brand1=${brand1Id}&brand2=${data.id}`)
          } else if (statusData.status === 'failed') {
            setAnalyzing(false)
            alert('Analysis failed. Please try again.')
          } else {
            setTimeout(pollForCompletion, 2000)
          }
        }
        pollForCompletion()
      }
    } catch {
      setAnalyzing(false)
      alert('Failed to start analysis')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
      </div>
    )
  }

  if (!brand1) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">No brand to compare. Analyze a brand first.</p>
          <Link href="/">
            <Button>Start Analysis</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Brand Comparison</h1>
            <p className="text-slate-500">Compare brand guidelines side by side</p>
          </div>
          <Link href="/">
            <Button variant="outline">New Analysis</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Add second brand form */}
        {!brand2 && (
          <div className="bg-white rounded-lg border p-6 mb-8">
            <h2 className="font-semibold mb-4">Add a brand to compare with {brand1.brandName}</h2>
            <div className="flex gap-3">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Enter URL (e.g., competitor.com)"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={analyzing}
              />
              <Button onClick={handleAnalyze} disabled={analyzing || !newUrl.trim()}>
                {analyzing ? 'Analyzing...' : 'Analyze & Compare'}
              </Button>
            </div>
          </div>
        )}

        {/* Comparison Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Brand 1 */}
          <ComparisonCard report={brand1} />

          {/* Brand 2 or placeholder */}
          {brand2 ? (
            <ComparisonCard report={brand2} />
          ) : (
            <div className="border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center min-h-[600px]">
              <div className="text-center text-slate-400">
                <p className="text-lg">Add another brand to compare</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function ComparisonCard({ report }: { report: BrandReport }) {
  const primaryColor = report.colors.colors.find(c => c.role === 'primary')?.hex || '#3B82F6'

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="p-6 text-white" style={{ backgroundColor: primaryColor }}>
        <div className="flex items-center gap-4">
          {report.logoUrl && (
            <img
              src={report.logoUrl}
              alt=""
              className="h-12 w-auto object-contain bg-white/10 rounded p-1"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <div>
            <h3 className="text-xl font-bold">{report.brandName}</h3>
            <p className="text-white/70 text-sm">{report.domain}</p>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="p-6 border-b">
        <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Colors</h4>
        <div className="flex gap-2">
          {report.colors.colors.slice(0, 5).map(color => (
            <div key={color.hex} className="text-center">
              <div
                className="w-12 h-12 rounded-lg shadow-sm mb-1"
                style={{ backgroundColor: color.hex }}
              />
              <p className="text-xs text-slate-500 font-mono">{color.hex}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="p-6 border-b">
        <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Typography</h4>
        {report.typography.fonts.slice(0, 2).map(font => (
          <p key={font.name} className="text-slate-700">
            <span className="font-semibold">{font.name}</span>
            <span className="text-slate-400 text-sm ml-2">({font.role})</span>
          </p>
        ))}
        {report.typography.fonts.length === 0 && (
          <p className="text-slate-400 text-sm">No custom fonts detected</p>
        )}
      </div>

      {/* Tone */}
      <div className="p-6 border-b">
        <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Tone & Voice</h4>
        <div className="flex flex-wrap gap-2">
          {report.tone.traits.slice(0, 5).map(trait => (
            <span
              key={trait}
              className="px-3 py-1 rounded-full text-sm text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {trait}
            </span>
          ))}
        </div>
      </div>

      {/* Social */}
      <div className="p-6">
        <h4 className="text-sm font-semibold text-slate-500 uppercase mb-3">Channels</h4>
        <div className="flex flex-wrap gap-2">
          {report.social.links.map(link => (
            <span
              key={link.url}
              className="px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-600 capitalize"
            >
              {link.platform}
            </span>
          ))}
          {report.social.links.length === 0 && (
            <p className="text-slate-400 text-sm">No social links found</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  )
}
