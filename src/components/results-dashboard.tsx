'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandReport, GeneratedAssets } from '@/lib/extractors/types'
import { GeneratedAssetsSection } from './generated-assets'
import { ShareModal } from './share-modal'
import { ExportDropdown } from './export-dropdown'
import { EmailModal } from './email-modal'

interface ResultsDashboardProps {
  report: BrandReport
}

function CopyableColor({ hex, name }: { hex: string; name: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Calculate if text should be light or dark based on background
  const isLight = (color: string) => {
    const hex = color.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 128
  }

  return (
    <button
      onClick={handleCopy}
      className="group flex-1 min-w-[100px]"
    >
      <div
        className="h-32 rounded-lg mb-3 flex items-end p-3 transition-transform hover:scale-[1.02]"
        style={{ backgroundColor: hex }}
      >
        <span
          className={`text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity ${
            isLight(hex) ? 'text-black/70' : 'text-white/70'
          }`}
        >
          {copied ? 'Copied!' : 'Click to copy'}
        </span>
      </div>
      <p className="font-mono text-sm font-medium">{hex.toUpperCase()}</p>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{name}</p>
    </button>
  )
}

export function ResultsDashboard({ report }: ResultsDashboardProps) {
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [isPublic, setIsPublic] = useState(report.isPublic || false)
  const [assets, setAssets] = useState<GeneratedAssets | undefined>(report.generatedAssets)
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateCount, setRegenerateCount] = useState(0)

  const primaryColor = report.colors.colors.find(c => c.role === 'primary')?.hex || '#3B82F6'
  const secondaryColor = report.colors.colors.find(c => c.role === 'secondary')?.hex || '#1E40AF'

  const handleTogglePublic = async (newIsPublic: boolean) => {
    const response = await fetch(`/api/report/${report.id}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublic: newIsPublic }),
    })
    if (response.ok) {
      setIsPublic(newIsPublic)
    }
  }

  const handleRegenerateAssets = async () => {
    setRegenerating(true)
    try {
      const response = await fetch(`/api/report/${report.id}/regenerate-assets`, {
        method: 'POST',
      })
      const data = await response.json()
      if (response.ok && data.assets) {
        setAssets(data.assets)
        setRegenerateCount(data.regenerateCount)
      }
    } catch (error) {
      console.error('Failed to regenerate assets:', error)
    }
    setRegenerating(false)
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
              ← Back
            </Link>
            <div className="h-4 w-px bg-slate-200" />
            {report.logoUrl ? (
              <img
                src={report.logoUrl}
                alt={`${report.brandName} logo`}
                className="h-6 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span className="font-semibold text-slate-700">{report.brandName}</span>
            )}
            <span className="text-sm text-slate-500">{report.domain}</span>
          </div>
          <div className="flex gap-3">
            <Link href={`/compare?brand1=${report.id}`}>
              <Button variant="outline" size="sm">Compare Brands</Button>
            </Link>
            <Link href="/">
              <Button variant="outline" size="sm">New Analysis</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setShareModalOpen(true)}>
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)}>
              Email
            </Button>
            <ExportDropdown report={report} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Brand Guidelines Title */}
          <div
            className="rounded-2xl p-10 text-white min-h-[280px] flex flex-col justify-end"
            style={{ backgroundColor: primaryColor }}
          >
            <h1 className="text-5xl font-bold leading-tight">
              Brand<br />Guidelines
            </h1>
            <p className="mt-4 text-white/70 text-sm">
              {report.brandName} · {new Date(report.generatedAt).toLocaleDateString()}
            </p>
          </div>

          {/* Welcome / About */}
          <div
            className="rounded-2xl p-10 text-white min-h-[280px]"
            style={{ backgroundColor: secondaryColor || '#8B7355' }}
          >
            <p className="text-white/60 text-sm uppercase tracking-wider mb-4">01. Welcome</p>
            <p className="text-lg leading-relaxed text-white/90">
              {report.summary.description?.slice(0, 300)}
              {report.summary.description && report.summary.description.length > 300 ? '...' : ''}
            </p>
          </div>
        </div>

        {/* Palette Section */}
        <div className="bg-white rounded-2xl p-10 mb-6">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Palette</h2>
            <span className="text-sm text-slate-400">{report.colors.colors.length} colors</span>
          </div>

          <div className="flex gap-4 flex-wrap">
            {report.colors.colors.slice(0, 5).map((color) => (
              <CopyableColor
                key={color.hex}
                hex={color.hex}
                name={color.role}
              />
            ))}
          </div>

          {report.colors.colors.length > 5 && (
            <p className="text-sm text-slate-400 mt-6">
              +{report.colors.colors.length - 5} more colors detected
            </p>
          )}
        </div>

        {/* Typography Section */}
        <div className="bg-white rounded-2xl p-10 mb-6">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Typography</h2>
            <span className="text-sm text-slate-400">{Math.min(report.typography.fonts.length, 5)} fonts</span>
          </div>

          {report.typography.fonts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {report.typography.fonts.slice(0, 5).map((font, index) => (
                <div key={font.name + index}>
                  <p
                    className="text-4xl font-bold mb-2"
                    style={{ fontFamily: `"${font.name}", sans-serif` }}
                  >
                    AaBb
                  </p>
                  <p className="text-sm text-slate-500">
                    {font.name} · {font.role === 'heading' ? 'Headings' : font.role === 'primary' ? 'Body' : font.role === 'button' ? 'Buttons' : 'Secondary'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">System fonts detected</p>
          )}
        </div>

        {/* Voice & Tone Section */}
        <div className="bg-white rounded-2xl p-10 mb-6">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Voice & Tone</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Traits */}
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider mb-4">Traits</p>
              <div className="flex flex-wrap gap-2">
                {report.tone.traits.slice(0, 5).map((trait) => (
                  <span
                    key={trait}
                    className="px-4 py-2 rounded-full text-sm font-medium"
                    style={{
                      backgroundColor: `${primaryColor}15`,
                      color: primaryColor,
                    }}
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            {/* Do */}
            <div>
              <p className="text-sm text-green-600 uppercase tracking-wider mb-4">Do</p>
              <ul className="space-y-2">
                {report.tone.doList.slice(0, 4).map((item, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Don't */}
            <div>
              <p className="text-sm text-red-600 uppercase tracking-wider mb-4">Don&apos;t</p>
              <ul className="space-y-2">
                {report.tone.dontList.slice(0, 4).map((item, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">−</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* SEO & Channels Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* SEO Health */}
          <div className="bg-white rounded-2xl p-10">
            <div className="flex items-center justify-between mb-6">
              <p className="text-slate-400 text-sm uppercase tracking-wider">SEO Health</p>
              <span
                className="text-2xl font-bold"
                style={{ color: primaryColor }}
              >
                {report.seo.score ?? Math.round((report.seo.confidence || 70) / 10)}/10
              </span>
            </div>

            <div className="space-y-3">
              {(report.seo.wins || []).slice(0, 3).map((win, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <p className="text-sm text-slate-600">{win.headline}</p>
                </div>
              ))}
              {(report.seo.issues || []).slice(0, 2).map((issue, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">!</span>
                  <p className="text-sm text-slate-600">{issue.headline}</p>
                </div>
              ))}
            </div>

            {report.seo.schemaTypes && report.seo.schemaTypes.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-slate-400 mb-2">Schema Types</p>
                <div className="flex flex-wrap gap-1">
                  {report.seo.schemaTypes.slice(0, 4).map((type, i) => (
                    <span key={i} className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Brand Channels */}
          <div className="bg-white rounded-2xl p-10">
            <p className="text-slate-400 text-sm uppercase tracking-wider mb-6">Channels</p>

            {report.social.links.length > 0 ? (
              <div className="space-y-3">
                {report.social.links.slice(0, 5).map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold uppercase"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {link.platform.slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium capitalize text-slate-900">{link.platform}</p>
                      {link.handle && (
                        <p className="text-sm text-slate-500">{link.handle}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No social channels found</p>
            )}

            {/* Address */}
            <div className="mt-6 pt-4 border-t">
              <p className="text-xs text-slate-400 mb-2">Address</p>
              {(() => {
                const validAddress = report.geo.addresses.find(addr =>
                  addr.length > 10 &&
                  !addr.startsWith('#') &&
                  !/^#?[0-9a-fA-F]{3,8}$/.test(addr) &&
                  /[a-zA-Z]/.test(addr)
                )
                return validAddress ? (
                  <p className="text-sm text-slate-600">{validAddress}</p>
                ) : (
                  <div>
                    <p className="text-sm text-slate-500">Address not found</p>
                    <p className="text-xs text-amber-600 mt-1">
                      Consider adding a physical address to improve local SEO.
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>

        {/* Generated Assets Section */}
        {assets && (
          <div className="bg-white rounded-2xl p-10 mb-6">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-3xl font-bold text-slate-900">Marketing Copy</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerateAssets}
                disabled={regenerating}
              >
                {regenerating ? 'Generating...' : 'Regenerate'}
              </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* LinkedIn */}
              <div className="bg-slate-50 rounded-xl p-6">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">LinkedIn</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {assets.linkedinPost.slice(0, 200)}...
                </p>
              </div>

              {/* Instagram */}
              <div className="bg-slate-50 rounded-xl p-6">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Instagram</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {assets.instagramPost.slice(0, 200)}...
                </p>
              </div>

              {/* Twitter */}
              <div className="bg-slate-50 rounded-xl p-6">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-3">Twitter</p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {assets.twitterPost}
                </p>
              </div>
            </div>

            {/* Ad Headlines */}
            <div className="mt-8">
              <p className="text-sm text-slate-400 uppercase tracking-wider mb-4">Ad Headlines</p>
              <div className="flex flex-wrap gap-2">
                {assets.adHeadlines.map((headline, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 bg-slate-100 rounded-full text-sm text-slate-700"
                  >
                    {headline}
                  </span>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-6">
              <p className="text-sm text-slate-400 uppercase tracking-wider mb-4">Call-to-Actions</p>
              <div className="flex flex-wrap gap-2">
                {assets.ctaVariations.map((cta, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {cta}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer Stats */}
        <div className="text-center py-8">
          <p className="text-sm text-slate-400">
            Analyzed {report.crawlStats.pagesProcessed} pages in {report.crawlStats.duration.toFixed(1)}s
          </p>
        </div>
      </main>

      {/* Modals */}
      <ShareModal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        reportId={report.id}
        slug={report.slug || ''}
        brandName={report.brandName}
        isPublic={isPublic}
        onTogglePublic={handleTogglePublic}
      />

      <EmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        reportId={report.id}
        brandName={report.brandName}
      />
    </div>
  )
}
