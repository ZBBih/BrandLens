'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, MapPin } from 'lucide-react'
import type { GeoData, SeoData, SocialData } from '@/lib/extractors/types'
import { Eyebrow } from './section'
import { PLATFORM_COLORS, PLATFORM_NAMES, SocialIcon } from './social-icons'

function seoRating(score: number): { label: string; className: string } {
  if (score >= 8) return { label: 'Good', className: 'bg-emerald-100 text-emerald-800' }
  if (score >= 5) return { label: 'Needs work', className: 'bg-amber-100 text-amber-900' }
  return { label: 'Poor', className: 'bg-red-100 text-red-800' }
}

function safeHttpUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 text-sm text-slate-800 hover:text-indigo-700"
    >
      <MapPin className="mt-0.5 size-4 shrink-0 text-slate-600 group-hover:text-indigo-700" aria-hidden />
      <span className="break-words group-hover:underline">{address}</span>
      <span className="sr-only">(open in Google Maps, new tab)</span>
    </a>
  )
}

function SeoPanel({ seo }: { seo: SeoData }) {
  const score = Number.isFinite(seo.score) ? Math.max(0, Math.min(10, Math.round(seo.score))) : null
  const rating = score === null ? null : seoRating(score)

  return (
    <section aria-labelledby="seo-heading" className="rounded-2xl bg-white p-6 sm:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 id="seo-heading" className="text-2xl font-bold text-slate-900">
          SEO Health
        </h2>
        {score !== null && rating && (
          <p className="flex items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">{score}/10</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${rating.className}`}>{rating.label}</span>
          </p>
        )}
      </div>

      {seo.wins.length > 0 && (
        <ul className="mb-4 space-y-3" aria-label="What is working">
          {seo.wins.slice(0, 3).map((win, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-emerald-900">{win.headline}</p>
                {win.detail && <p className="mt-1 text-xs text-emerald-900">{win.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {seo.issues.length > 0 && (
        <ul className="space-y-3" aria-label="Issues to fix">
          {seo.issues.slice(0, 4).map((issue, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-800" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-950">{issue.headline}</p>
                {issue.detail && <p className="mt-1 text-xs text-amber-950">{issue.detail}</p>}
                {issue.action && <p className="mt-2 text-xs font-semibold text-amber-950">Fix: {issue.action}</p>}
                {issue.affectedPages && issue.affectedPages.length > 0 && (
                  <p className="mt-2 break-all text-xs text-amber-950">Affected: {issue.affectedPages.slice(0, 3).join(', ')}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {seo.schemaTypes.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <Eyebrow as="p" className="mb-2 text-xs">
            Structured data found
          </Eyebrow>
          <ul className="flex flex-wrap gap-1">
            {seo.schemaTypes.map(type => (
              <li key={type} className="rounded bg-sky-100 px-2 py-1 text-xs text-sky-900">
                {type}
              </li>
            ))}
          </ul>
        </div>
      )}

      {seo.googlePreview?.title && (
        <div className="mt-6 border-t pt-4">
          <Eyebrow as="p" className="mb-3 text-xs">
            Google search preview
          </Eyebrow>
          <div className="rounded-lg border bg-white p-3">
            <p className="truncate text-sm font-medium text-[#1a0dab]">{seo.googlePreview.title}</p>
            <p className="truncate text-xs text-[#006621]">{seo.googlePreview.url}</p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-700">{seo.googlePreview.description}</p>
          </div>
        </div>
      )}
    </section>
  )
}

function ChannelsPanel({ social, geo }: { social: SocialData; geo: GeoData }) {
  const [showAllAddresses, setShowAllAddresses] = useState(false)
  const links = social.links.filter(link => safeHttpUrl(link.url))
  const addresses = geo.addresses

  return (
    <section aria-labelledby="channels-heading" className="rounded-2xl bg-white p-6 sm:p-10">
      <h2 id="channels-heading" className="mb-6 text-2xl font-bold text-slate-900">
        Channels
      </h2>

      {links.length > 0 ? (
        <ul className="space-y-2">
          {links.slice(0, 6).map(link => {
            const platform = link.platform.toLowerCase()
            return (
              <li key={link.url}>
                <a
                  href={safeHttpUrl(link.url)}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: PLATFORM_COLORS[platform] ?? '#334155' }}>
                    <SocialIcon platform={platform} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-900">{PLATFORM_NAMES[platform] ?? link.platform}</span>
                    {link.handle && <span className="block truncate text-sm text-slate-700">{link.handle}</span>}
                  </span>
                  <ExternalLink className="ml-auto size-4 shrink-0 text-slate-500" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-slate-700">No social channels were linked from the site.</p>
      )}

      <div className="mt-6 border-t pt-4">
        {addresses.length === 0 ? (
          <>
            <Eyebrow className="mb-2 text-xs">Address</Eyebrow>
            <p className="text-sm text-slate-700">No physical address was found.</p>
            <p className="mt-1 text-xs text-slate-700">Listing an address helps local search visibility.</p>
          </>
        ) : (
          <>
            <Eyebrow className="mb-2 text-xs">{addresses.length === 1 ? 'Address' : `Locations (${addresses.length})`}</Eyebrow>
            <AddressLink address={addresses[0]} />
            {addresses.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowAllAddresses(!showAllAddresses)}
                  aria-expanded={showAllAddresses}
                  aria-controls="more-addresses"
                  className="mt-2 inline-flex min-h-8 items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                >
                  <ChevronDown className={`size-3.5 transition-transform ${showAllAddresses ? 'rotate-180' : ''}`} aria-hidden />
                  {showAllAddresses ? 'Show fewer' : `${addresses.length - 1} more location${addresses.length > 2 ? 's' : ''}`}
                </button>
                {showAllAddresses && (
                  <ul id="more-addresses" className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
                    {addresses.slice(1).map((address, i) => (
                      <li key={i}>
                        <AddressLink address={address} />
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export function SeoChannelsSection({ seo, social, geo }: { seo: SeoData; social: SocialData; geo: GeoData }) {
  return (
    <div className="mb-6 grid gap-6 md:grid-cols-2">
      <SeoPanel seo={seo} />
      <ChannelsPanel social={social} geo={geo} />
    </div>
  )
}
