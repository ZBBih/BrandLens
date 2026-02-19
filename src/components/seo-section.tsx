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
  const [activeTab, setActiveTab] = useState<'overview' | 'social'>('overview')

  // Handle backwards compatibility for old reports without new fields
  const wins = seo.wins || []
  const issues = seo.issues || []
  const score = seo.score ?? Math.round((seo.confidence || 70) / 10)
  const socialPreview = seo.socialPreview || {
    title: seo.titlePatterns?.[0] || 'No title found',
    description: seo.descriptionPatterns?.[0] || 'No description found',
    image: null,
    siteName: seo.evidence?.[0]?.url ? new URL(seo.evidence[0].url).hostname : 'Unknown',
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
          onClick={() => setActiveTab('social')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'social'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Social Preview
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

      {activeTab === 'social' && (
        <div>
          {/* Social Share Preview */}
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
