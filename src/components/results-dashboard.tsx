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
  const [showAllColors, setShowAllColors] = useState(false)
  const [showAllAddresses, setShowAllAddresses] = useState(false)

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

        {/* Logo Section */}
        {report.logoUrl && (
          <div className="bg-white rounded-2xl p-10 mb-6">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-3xl font-bold text-slate-900">Logo</h2>
              <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Detected</span>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Light Background Preview */}
              <div className="bg-slate-100 rounded-xl p-8 flex items-center justify-center min-h-[200px]">
                <img
                  src={report.logoUrl}
                  alt={`${report.brandName} logo`}
                  className="max-h-24 max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.parentElement!.style.display = 'none'
                  }}
                />
              </div>

              {/* Dark Background Preview */}
              <div className="bg-slate-800 rounded-xl p-8 flex items-center justify-center min-h-[200px]">
                <img
                  src={report.logoUrl}
                  alt={`${report.brandName} logo on dark`}
                  className="max-h-24 max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.parentElement!.style.display = 'none'
                  }}
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                <p>Source: {report.logoUrl.includes('brandfetch') ? 'Brandfetch (Verified)' : 'Website Extraction'}</p>
              </div>
              <a
                href={report.logoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Logo
              </a>
            </div>
          </div>
        )}

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
            <div className="mt-6">
              <button
                onClick={() => setShowAllColors(!showAllColors)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${showAllColors ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {showAllColors ? 'Show less' : `Show all ${report.colors.colors.length} colors`}
              </button>

              {showAllColors && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex gap-4 flex-wrap">
                    {report.colors.colors.slice(5).map((color) => (
                      <CopyableColor
                        key={color.hex}
                        hex={color.hex}
                        name={color.role}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Typography Section */}
        <div className="bg-white rounded-2xl p-10 mb-6">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Typography</h2>
            <div className="flex items-center gap-3">
              {report.typography.googleFontsDetected && (
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Google Fonts</span>
              )}
              <span className="text-sm text-slate-400">{Math.min(report.typography.fonts.length, 5)} fonts</span>
            </div>
          </div>

          {report.typography.fonts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {report.typography.fonts.slice(0, 5).map((font, index) => {
                const getRoleName = (role: string) => {
                  switch (role) {
                    case 'heading': return 'Headings'
                    case 'primary': return 'Body'
                    case 'button': return 'Buttons'
                    case 'secondary': return 'Secondary'
                    case 'accent': return 'Accent'
                    default: return role
                  }
                }

                const getSourceBadge = (source: string) => {
                  switch (source) {
                    case 'verified': return { bg: 'bg-green-100', text: 'text-green-700', label: 'Verified' }
                    case 'extracted': return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Detected' }
                    case 'inferred': return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Inferred' }
                    default: return { bg: 'bg-slate-100', text: 'text-slate-600', label: source }
                  }
                }

                const sourceBadge = getSourceBadge(font.source)

                return (
                  <div key={font.name + index} className="bg-slate-50 rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${sourceBadge.bg} ${sourceBadge.text}`}
                      >
                        {sourceBadge.label}
                      </span>
                      <span className="text-xs text-slate-400">{font.confidence}% conf.</span>
                    </div>
                    <p
                      className="text-4xl font-bold mb-2"
                      style={{ fontFamily: `"${font.name}", sans-serif` }}
                    >
                      AaBb
                    </p>
                    <p className="font-medium text-slate-900 mb-1">{font.name}</p>
                    <p className="text-sm text-slate-500 mb-2">{getRoleName(font.role)}</p>

                    {font.variants && font.variants.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-400 mb-1">Weights</p>
                        <div className="flex flex-wrap gap-1">
                          {font.variants.map((variant, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-slate-200 rounded">
                              {variant}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {font.googleFontsUrl && (
                      <a
                        href={font.googleFontsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        View on Google Fonts
                      </a>
                    )}
                  </div>
                )
              })}
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
              <div className="flex items-center gap-2">
                <span
                  className="text-2xl font-bold"
                  style={{ color: primaryColor }}
                >
                  {report.seo.score ?? Math.round((report.seo.confidence || 70) / 10)}/10
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  (report.seo.score || 7) >= 8 ? 'bg-green-100 text-green-700' :
                  (report.seo.score || 7) >= 6 ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {(report.seo.score || 7) >= 8 ? 'Good' : (report.seo.score || 7) >= 6 ? 'Needs Work' : 'Poor'}
                </span>
              </div>
            </div>

            {/* Wins */}
            <div className="space-y-3 mb-4">
              {(report.seo.wins || []).slice(0, 3).map((win, i) => (
                <div key={i} className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800">{win.headline}</p>
                      {win.detail && (
                        <p className="text-xs text-green-600 mt-1">{win.detail}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Issues */}
            <div className="space-y-3">
              {(report.seo.issues || []).slice(0, 3).map((issue, i) => (
                <div key={i} className="p-3 bg-amber-50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">!</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-800">{issue.headline}</p>
                      {issue.detail && (
                        <p className="text-xs text-amber-600 mt-1">{issue.detail}</p>
                      )}
                      {issue.action && (
                        <p className="text-xs text-amber-700 mt-2 font-medium">Fix: {issue.action}</p>
                      )}
                      {issue.affectedPages && issue.affectedPages.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-amber-600">Affected: {issue.affectedPages.slice(0, 3).join(', ')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {report.seo.schemaTypes && report.seo.schemaTypes.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-slate-400 mb-2">Schema Types Detected</p>
                <div className="flex flex-wrap gap-1">
                  {report.seo.schemaTypes.map((type, i) => (
                    <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Google Preview */}
            {report.seo.googlePreview && (
              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-slate-400 mb-3">Google Search Preview</p>
                <div className="p-3 bg-white border rounded-lg">
                  <p className="text-blue-700 text-sm font-medium truncate">{report.seo.googlePreview.title}</p>
                  <p className="text-green-700 text-xs truncate">{report.seo.googlePreview.url}</p>
                  <p className="text-slate-600 text-xs mt-1 line-clamp-2">{report.seo.googlePreview.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Brand Channels */}
          <div className="bg-white rounded-2xl p-10">
            <p className="text-slate-400 text-sm uppercase tracking-wider mb-6">Channels</p>

            {report.social.links.length > 0 ? (
              <div className="space-y-3">
                {report.social.links.slice(0, 5).map((link) => {
                  const platform = link.platform.toLowerCase()
                  const displayName = platform === 'twitter' ? 'X' : link.platform

                  const getSocialIcon = () => {
                    switch (platform) {
                      case 'youtube':
                        return (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                        )
                      case 'twitter':
                        return (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                        )
                      case 'instagram':
                        return (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                          </svg>
                        )
                      case 'facebook':
                        return (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                          </svg>
                        )
                      case 'linkedin':
                        return (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                          </svg>
                        )
                      case 'tiktok':
                        return (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                          </svg>
                        )
                      case 'pinterest':
                        return (
                          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                            <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                          </svg>
                        )
                      default:
                        return <span className="text-xs font-bold uppercase">{link.platform.slice(0, 2)}</span>
                    }
                  }

                  const getSocialColor = () => {
                    switch (platform) {
                      case 'youtube': return '#FF0000'
                      case 'twitter': return '#000000'
                      case 'instagram': return '#E4405F'
                      case 'facebook': return '#1877F2'
                      case 'linkedin': return '#0A66C2'
                      case 'tiktok': return '#000000'
                      case 'pinterest': return '#BD081C'
                      default: return primaryColor
                    }
                  }

                  return (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: getSocialColor() }}
                      >
                        {getSocialIcon()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{displayName}</p>
                        {link.handle && (
                          <p className="text-sm text-slate-500">{link.handle}</p>
                        )}
                      </div>
                    </a>
                  )
                })}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No social channels found</p>
            )}

            {/* Addresses */}
            <div className="mt-6 pt-4 border-t">
              {(() => {
                const addresses = report.geo.addresses

                const getGoogleMapsUrl = (address: string) => {
                  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
                }

                const AddressLink = ({ address }: { address: string }) => (
                  <a
                    href={getGoogleMapsUrl(address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 text-sm text-slate-600 hover:text-blue-600 transition-colors group"
                  >
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="group-hover:underline">{address}</span>
                  </a>
                )

                if (addresses.length === 0) {
                  return (
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Address</p>
                      <p className="text-sm text-slate-500">Address not found</p>
                      <p className="text-xs text-amber-600 mt-1">
                        Consider adding a physical address to improve local SEO.
                      </p>
                    </div>
                  )
                }

                if (addresses.length === 1) {
                  return (
                    <div>
                      <p className="text-xs text-slate-400 mb-2">Address</p>
                      <AddressLink address={addresses[0]} />
                    </div>
                  )
                }

                return (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">
                      Locations ({addresses.length})
                    </p>
                    <AddressLink address={addresses[0]} />
                    {addresses.length > 1 && (
                      <>
                        <button
                          onClick={() => setShowAllAddresses(!showAllAddresses)}
                          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors mt-2"
                        >
                          <svg
                            className={`w-3 h-3 transition-transform ${showAllAddresses ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          {showAllAddresses ? 'Show less' : `+${addresses.length - 1} more location${addresses.length > 2 ? 's' : ''}`}
                        </button>
                        {showAllAddresses && (
                          <div className="mt-2 space-y-2 pl-2 border-l-2 border-slate-200">
                            {addresses.slice(1).map((addr, i) => (
                              <AddressLink key={i} address={addr} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
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

        {/* AI Insights Section */}
        {report.aiInsights && (
          <div className="bg-white rounded-2xl p-10 mb-6">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="text-3xl font-bold text-slate-900">AI Insights</h2>
              <span className="text-xs text-slate-400">Powered by Claude</span>
            </div>

            {/* Executive Summary */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Executive Summary
              </h3>
              <div className="bg-slate-50 rounded-xl p-6">
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {report.aiInsights.executiveSummary}
                </p>
              </div>
            </div>

            {/* Action Items */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Recommended Action Items
              </h3>
              <div className="bg-slate-50 rounded-xl p-6">
                <ol className="space-y-3">
                  {report.aiInsights.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: primaryColor }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-700">{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Score Explanation & Competitor Positioning - Side by Side */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Score Explanation */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Score Explanation
                </h3>
                <div className="bg-slate-50 rounded-xl p-6 h-full">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {report.aiInsights.scoreExplanation}
                  </p>
                </div>
              </div>

              {/* Competitor Positioning */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" style={{ color: primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  Competitor Positioning
                </h3>
                <div className="bg-slate-50 rounded-xl p-6 h-full">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {report.aiInsights.competitorPositioning}
                  </p>
                </div>
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
