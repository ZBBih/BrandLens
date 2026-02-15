'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { GeneratedAssets } from '@/lib/extractors/types'

interface GeneratedAssetsProps {
  assets: GeneratedAssets
  reportId: string
  primaryColor?: string
  onRegenerate?: () => void
  regenerating?: boolean
  regenerateCount?: number
}

interface AssetCardProps {
  title: string
  content: string | string[]
  primaryColor?: string
  icon?: React.ReactNode
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label || 'Copy'}
        </>
      )}
    </button>
  )
}

function AssetCard({ title, content, primaryColor, icon }: AssetCardProps) {
  const isArray = Array.isArray(content)
  const fullText = isArray ? content.join('\n') : content

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-800">{title}</h3>
        </div>
        <CopyButton text={fullText} label="Copy all" />
      </div>

      {isArray ? (
        <ul className="space-y-3">
          {content.map((item, i) => (
            <li key={i} className="flex items-start justify-between gap-4">
              <span className="text-sm text-slate-600 flex-1">{item}</span>
              <CopyButton text={item} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600 whitespace-pre-wrap">{content}</p>
      )}
    </div>
  )
}

function SocialPostCard({
  platform,
  content,
  primaryColor,
  icon,
  charLimit,
}: {
  platform: string
  content: string
  primaryColor?: string
  icon: React.ReactNode
  charLimit?: number
}) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div
        className="px-6 py-3 flex items-center justify-between"
        style={{ backgroundColor: primaryColor || '#3B82F6' }}
      >
        <div className="flex items-center gap-2 text-white">
          {icon}
          <span className="font-medium">{platform}</span>
        </div>
        {charLimit && (
          <span className="text-xs text-white/70">
            {content.length}/{charLimit}
          </span>
        )}
      </div>
      <div className="p-6">
        <p className="text-sm text-slate-600 whitespace-pre-wrap mb-4">{content}</p>
        <CopyButton text={content} label="Copy post" />
      </div>
    </div>
  )
}

export function GeneratedAssetsSection({
  assets,
  reportId,
  primaryColor,
  onRegenerate,
  regenerating,
  regenerateCount = 0,
}: GeneratedAssetsProps) {
  return (
    <section className="mb-16">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
          <h2 className="text-2xl font-semibold text-slate-800">Generated Assets</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            Ready-to-use copy
          </span>
        </div>
        {onRegenerate && regenerateCount < 3 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            disabled={regenerating}
            className="gap-2"
          >
            <svg
              className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {regenerating ? 'Regenerating...' : `Regenerate (${3 - regenerateCount} left)`}
          </Button>
        )}
      </div>

      {/* Elevator Pitch */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wide">
            Elevator Pitch
          </h3>
          <CopyButton text={assets.elevatorPitch} />
        </div>
        <p className="text-xl font-medium leading-relaxed">{assets.elevatorPitch}</p>
      </div>

      {/* Social Posts */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <SocialPostCard
          platform="LinkedIn"
          content={assets.linkedinPost}
          primaryColor="#0A66C2"
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          }
        />
        <SocialPostCard
          platform="Instagram"
          content={assets.instagramPost}
          primaryColor="#E4405F"
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
          }
        />
        <SocialPostCard
          platform="Twitter/X"
          content={assets.twitterPost}
          primaryColor="#000000"
          charLimit={280}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          }
        />
      </div>

      {/* Other Assets */}
      <div className="grid md:grid-cols-2 gap-6">
        <AssetCard
          title="Ad Headlines"
          content={assets.adHeadlines}
          primaryColor={primaryColor}
          icon={
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          }
        />
        <AssetCard
          title="Email Subject Lines"
          content={assets.emailSubjects}
          primaryColor={primaryColor}
          icon={
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
        />
        <AssetCard
          title="CTA Button Variations"
          content={assets.ctaVariations}
          primaryColor={primaryColor}
          icon={
            <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
          }
        />
      </div>

      <p className="text-xs text-slate-400 mt-6 text-center">
        Generated {new Date(assets.generatedAt).toLocaleDateString()} - Assets are based on your brand analysis
      </p>
    </section>
  )
}
