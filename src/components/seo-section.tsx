'use client'

import { useState } from 'react'
import { SeoData, SEOItem } from '@/lib/extractors/types'
import { InfoTooltip } from './info-tooltip'

interface SeoSectionProps {
  seo: SeoData
  primaryColor?: string
}

function ScoreBadge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 8) return 'bg-green-100 text-green-700 border-green-200'
    if (s >= 6) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    return 'bg-red-100 text-red-700 border-red-200'
  }

  return (
    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-semibold ${getColor(score)}`}>
      <span>{score}/10</span>
    </div>
  )
}

function WinItem({ item }: { item: SEOItem }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="font-medium text-slate-800">{item.headline}</p>
        <p className="text-sm text-slate-500 mt-0.5">{item.detail}</p>
      </div>
    </div>
  )
}

function IssueItem({ item }: { item: SEOItem }) {
  const [showPages, setShowPages] = useState(false)

  const getIcon = () => {
    if (item.status === 'bad') {
      return (
        <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )
    }
    return (
      <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-3">
        {getIcon()}
        <div className="flex-1">
          <p className="font-medium text-slate-800">{item.headline}</p>
          <p className="text-sm text-slate-500 mt-0.5">{item.detail}</p>
          {item.action && (
            <div className="mt-2 bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-700">How to fix: </span>
                {item.action}
              </p>
            </div>
          )}
          {item.affectedPages && item.affectedPages.length > 0 && (
            <button
              onClick={() => setShowPages(!showPages)}
              className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showPages ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              View affected pages ({item.affectedPages.length})
            </button>
          )}
          {showPages && item.affectedPages && (
            <ul className="mt-2 pl-4 border-l-2 border-slate-200 space-y-1">
              {item.affectedPages.slice(0, 10).map((page, i) => (
                <li key={i} className="text-sm text-slate-500 font-mono">{page}</li>
              ))}
              {item.affectedPages.length > 10 && (
                <li className="text-sm text-slate-400">...and {item.affectedPages.length - 10} more</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function GooglePreviewComponent({ title, url, description }: { title: string; url: string; description: string }) {
  // Truncate title and description to simulate Google display
  const displayTitle = title.length > 60 ? title.slice(0, 57) + '...' : title
  const displayDesc = description.length > 160 ? description.slice(0, 157) + '...' : description

  let displayUrl = ''
  try {
    const u = new URL(url)
    displayUrl = u.hostname + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    displayUrl = url
  }

  return (
    <div className="bg-white rounded-lg border p-4 max-w-xl">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
          <span className="text-xs font-bold text-slate-500">
            {displayUrl.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="text-sm text-slate-600">{displayUrl}</div>
      </div>
      <h3 className="text-lg text-blue-800 hover:underline cursor-pointer leading-snug">
        {displayTitle}
      </h3>
      <p className="text-sm text-slate-600 mt-1 leading-relaxed">{displayDesc}</p>
    </div>
  )
}

function SocialPreviewComponent({
  title,
  description,
  image,
  siteName,
}: {
  title: string
  description: string
  image: string | null
  siteName: string
}) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden max-w-md">
      {image ? (
        <div
          className="w-full h-40 bg-slate-200 bg-cover bg-center"
          style={{ backgroundImage: `url(${image})` }}
        />
      ) : (
        <div className="w-full h-40 bg-slate-100 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-slate-400">No og:image set</p>
          </div>
        </div>
      )}
      <div className="p-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide">{siteName}</p>
        <h3 className="font-semibold text-slate-800 mt-1 line-clamp-2">{title}</h3>
        <p className="text-sm text-slate-500 mt-1 line-clamp-2">{description}</p>
      </div>
    </div>
  )
}

export function SeoSection({ seo, primaryColor }: SeoSectionProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'previews'>('overview')

  // Handle backwards compatibility for old reports without new fields
  const wins = seo.wins || []
  const issues = seo.issues || []
  const score = seo.score ?? Math.round((seo.confidence || 70) / 10)
  const googlePreview = seo.googlePreview || {
    title: seo.titlePatterns?.[0] || 'No title found',
    url: seo.evidence?.[0]?.url || '',
    description: seo.descriptionPatterns?.[0] || 'No description found',
  }
  const socialPreview = seo.socialPreview || {
    title: googlePreview.title,
    description: googlePreview.description,
    image: null,
    siteName: googlePreview.url ? new URL(googlePreview.url).hostname : 'Unknown',
  }

  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor || '#3B82F6' }} />
          <h2 className="text-2xl font-semibold text-slate-800">
            <InfoTooltip term="schema">SEO Health</InfoTooltip>
          </h2>
        </div>
        <ScoreBadge score={score} />
      </div>

      <p className="text-slate-500 mb-6">How easily can people find you on Google?</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('previews')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'previews'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Search Previews
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* What's Working */}
          {wins.length > 0 && (
            <div className="bg-green-50 rounded-xl p-6">
              <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                What&apos;s Working
              </h3>
              <div className="divide-y divide-green-200">
                {wins.map((item, i) => (
                  <WinItem key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Needs Attention */}
          {issues.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-6">
              <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Needs Attention
              </h3>
              <div>
                {issues.map((item, i) => (
                  <IssueItem key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* No issues */}
          {issues.length === 0 && wins.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-6 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-semibold text-slate-700">Looking Good!</p>
                <p className="text-sm text-slate-500 mt-1">No major SEO issues found.</p>
              </div>
            </div>
          )}

          {/* Legacy fallback when no wins/issues data */}
          {wins.length === 0 && issues.length === 0 && (
            <div className="col-span-2 border rounded-xl p-6">
              <div className="space-y-2 text-sm">
                {seo.titlePatterns?.slice(0, 2).map((p, i) => (
                  <p key={i} className="text-slate-600">• {p}</p>
                ))}
                {seo.schemaTypes?.length > 0 && (
                  <p className="text-slate-600">• Schema: {seo.schemaTypes.join(', ')}</p>
                )}
                {seo.hasCanonical && (
                  <p className="text-slate-600">• Canonical tags present</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'previews' && (
        <div className="space-y-8">
          {/* Google Search Preview */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google Search Preview
            </h3>
            <p className="text-sm text-slate-500 mb-4">This is how your homepage appears in search results:</p>
            <GooglePreviewComponent
              title={googlePreview.title}
              url={googlePreview.url}
              description={googlePreview.description}
            />
          </div>

          {/* Social Share Preview */}
          <div>
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Social Share Preview
            </h3>
            <p className="text-sm text-slate-500 mb-4">This is how your site looks when shared on Facebook/LinkedIn:</p>
            <SocialPreviewComponent
              title={socialPreview.title}
              description={socialPreview.description}
              image={socialPreview.image}
              siteName={socialPreview.siteName}
            />
            {socialPreview.image && (
              <p className="text-sm text-green-600 mt-3 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Social image found
              </p>
            )}
          </div>
        </div>
      )}

      {/* Schema types badge */}
      {seo.schemaTypes.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-slate-500 mb-2">
            <InfoTooltip term="schema">Structured data found:</InfoTooltip>
          </p>
          <div className="flex flex-wrap gap-2">
            {seo.schemaTypes.map((type, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-600"
              >
                {type}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
