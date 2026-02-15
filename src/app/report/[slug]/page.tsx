'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandReport } from '@/lib/extractors/types'
import { ConsistencyGrade } from '@/components/consistency-grade'

export default function PublicReportPage() {
  const params = useParams()
  const slug = params.slug as string

  const [report, setReport] = useState<BrandReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch(`/api/public-report/${slug}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Report not found')
          } else {
            setError('Failed to load report')
          }
          return
        }
        const data = await response.json()
        setReport(data.report)
      } catch {
        setError('Failed to load report')
      } finally {
        setLoading(false)
      }
    }

    fetchReport()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Report Not Found</h1>
          <p className="text-slate-500 mb-6">This report doesn&apos;t exist or isn&apos;t public.</p>
          <Link href="/">
            <Button>Analyze Your Brand</Button>
          </Link>
        </div>
      </div>
    )
  }

  const primaryColor = report.colors.colors.find(c => c.role === 'primary')?.hex || '#3B82F6'
  const secondaryColor = report.colors.colors.find(c => c.role === 'secondary')?.hex || '#1E40AF'

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="text-white py-12 px-8" style={{ backgroundColor: primaryColor }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {report.logoUrl && (
                <img
                  src={report.logoUrl}
                  alt=""
                  className="h-16 w-auto object-contain bg-white/10 rounded-lg p-2"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              )}
              <div>
                <h1 className="text-4xl font-bold tracking-tight">{report.brandName}</h1>
                <p className="text-white/80 mt-2 text-lg">Brand Report</p>
              </div>
            </div>
            <Link href="/">
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                Analyze Your Brand
              </Button>
            </Link>
          </div>
          <p className="text-white/60 mt-4 text-sm">
            Generated {new Date(report.generatedAt).toLocaleDateString()}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-12">
        {/* Consistency Grade */}
        {report.consistency && <ConsistencyGrade data={report.consistency} />}

        {/* Color Palette */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold text-slate-800 mb-8">Color Palette</h2>
          <div className="flex gap-4 flex-wrap">
            {report.colors.colors.slice(0, 6).map(color => (
              <div key={color.hex}>
                <div
                  className="w-24 h-24 rounded-lg shadow-lg mb-3"
                  style={{ backgroundColor: color.hex }}
                />
                <p className="font-mono text-sm">{color.hex.toUpperCase()}</p>
                <p className="text-xs text-slate-400 capitalize">{color.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Typography */}
        <section
          className="mb-16 p-8 rounded-2xl text-white"
          style={{ backgroundColor: secondaryColor || primaryColor }}
        >
          <h2 className="text-2xl font-semibold mb-8">Typography</h2>
          <div className="grid md:grid-cols-2 gap-12">
            {report.typography.fonts.slice(0, 2).map(font => (
              <div key={font.name}>
                <p className="text-6xl font-bold mb-4">Aa</p>
                <p className="text-xl font-semibold uppercase tracking-wide mb-2">{font.name}</p>
                <p className="text-white/60 text-sm capitalize">{font.role} Font</p>
              </div>
            ))}
          </div>
        </section>

        {/* Tone & Voice */}
        <section className="mb-16 bg-slate-50 rounded-2xl p-8">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">Tone & Voice</h2>
          <div className="flex flex-wrap gap-2 mb-6">
            {report.tone.traits.map(trait => (
              <span
                key={trait}
                className="px-4 py-2 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {trait}
              </span>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-green-600 uppercase mb-2">Do</p>
              <ul className="space-y-1">
                {report.tone.doList.slice(0, 3).map((item, i) => (
                  <li key={i} className="text-sm text-slate-600">+ {item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-red-600 uppercase mb-2">Don&apos;t</p>
              <ul className="space-y-1">
                {report.tone.dontList.slice(0, 3).map((item, i) => (
                  <li key={i} className="text-sm text-slate-600">- {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Brand Summary */}
        <section className="mb-16 border rounded-2xl p-8">
          <h2 className="text-2xl font-semibold text-slate-800 mb-6">Brand Summary</h2>
          <p className="text-slate-600 text-lg mb-6">{report.summary.description}</p>
          <div className="grid md:grid-cols-3 gap-6">
            {report.summary.valueProposition && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Value Proposition</p>
                <p className="text-sm text-slate-700">{report.summary.valueProposition}</p>
              </div>
            )}
            {report.summary.targetAudience && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Target Audience</p>
                <p className="text-sm text-slate-700">{report.summary.targetAudience}</p>
              </div>
            )}
            {report.summary.industry && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Industry</p>
                <p className="text-sm text-slate-700">{report.summary.industry}</p>
              </div>
            )}
          </div>
        </section>

        {/* Social Links */}
        {report.social.links.length > 0 && (
          <section className="mb-16">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6">Brand Channels</h2>
            <div className="flex flex-wrap gap-3">
              {report.social.links.map(link => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <span className="capitalize">{link.platform}</span>
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer CTA */}
      <footer className="bg-slate-900 text-white py-12 px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-4">Want a brand report for your website?</h2>
          <p className="text-slate-400 mb-6">
            Analyze your brand&apos;s colors, typography, tone, and more in seconds.
          </p>
          <Link href="/">
            <Button size="lg" className="bg-white text-slate-900 hover:bg-slate-100">
              Analyze Your Brand Free
            </Button>
          </Link>
          <p className="text-slate-500 text-sm mt-8">
            Powered by BrandLens
          </p>
        </div>
      </footer>
    </div>
  )
}
