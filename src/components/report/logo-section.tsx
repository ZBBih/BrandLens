'use client'

import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Section } from './section'

/**
 * Only https images, or the sanitized inline-SVG data URLs the logo extractor
 * produces, are ever rendered. SVG inside <img> cannot run scripts.
 */
export function safeImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.startsWith('data:image/svg+xml;base64,') && url.length < 60_000) return url
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/**
 * A brand logo that disappears cleanly if it fails to load
 */
export function BrandLogo({ url, alt, className, onFail }: { url?: string; alt: string; className?: string; onFail?: () => void }) {
  const [failed, setFailed] = useState(false)
  const src = safeImageUrl(url)
  if (!src || failed) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party hosts; the optimizer is disabled
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={() => {
        setFailed(true)
        onFail?.()
      }}
    />
  )
}

export function LogoSection({ logoUrl, brandName, fromBrandfetch }: { logoUrl?: string; brandName: string; fromBrandfetch: boolean }) {
  const [failed, setFailed] = useState(false)
  const src = safeImageUrl(logoUrl)
  if (!src || failed) return null

  return (
    <Section id="logo" title="Logo" className="mb-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex min-h-[180px] items-center justify-center rounded-xl bg-slate-100 p-8">
          <BrandLogo url={src} alt={`${brandName} logo on a light background`} className="max-h-24 max-w-full object-contain" onFail={() => setFailed(true)} />
        </div>
        <div className="flex min-h-[180px] items-center justify-center rounded-xl bg-slate-800 p-8">
          <BrandLogo url={src} alt={`${brandName} logo on a dark background`} className="max-h-24 max-w-full object-contain" />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Source: {fromBrandfetch ? 'Brandfetch' : 'the website'}</p>
        {!src.startsWith('data:') && (
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-100 px-4 text-sm font-medium text-slate-800 hover:bg-slate-200"
          >
            <ExternalLink className="size-4" aria-hidden />
            Open logo file
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
      </div>
    </Section>
  )
}
