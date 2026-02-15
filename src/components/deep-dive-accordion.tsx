'use client'

import { useState } from 'react'
import { SeoData, GeoData, MarketingData, Evidence, ToneData } from '@/lib/extractors/types'
import { SeoSection } from './seo-section'

interface DeepDiveAccordionProps {
  seo: SeoData
  geo: GeoData
  marketing: MarketingData
  tone: ToneData
  primaryColor: string
}

interface AccordionItemProps {
  title: string
  icon: React.ReactNode
  badge?: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function AccordionItem({ title, icon, badge, children, defaultOpen = false }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-400">{icon}</span>
          <span className="font-medium text-slate-900">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded-full">
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-6 pb-6">
          {children}
        </div>
      )}
    </div>
  )
}

export function DeepDiveAccordion({
  seo,
  geo,
  marketing,
  tone,
  primaryColor,
}: DeepDiveAccordionProps) {
  const seoScore = seo.score ?? Math.round((seo.confidence || 70) / 10)
  const locationCount = geo.addresses.length + (geo.hasGoogleMaps ? 1 : 0)

  return (
    <section className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <h3 className="p-6 font-semibold text-slate-900 border-b bg-slate-50">
        Detailed Analysis
      </h3>

      {/* SEO Details */}
      <AccordionItem
        title="SEO Health"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
        badge={`${seoScore}/10`}
      >
        <SeoSection seo={seo} primaryColor={primaryColor} />
      </AccordionItem>

      {/* Local Presence */}
      <AccordionItem
        title="Local Presence"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
        badge={locationCount > 0 ? `${locationCount} found` : undefined}
      >
        <div className="space-y-4">
          {geo.addresses.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Addresses</h4>
              <div className="space-y-2">
                {geo.addresses.map((address, i) => (
                  <p key={i} className="text-sm text-slate-600 flex items-start gap-2">
                    <svg className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {address}
                  </p>
                ))}
              </div>
            </div>
          )}

          {geo.phoneNumbers.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Phone Numbers</h4>
              <div className="space-y-2">
                {geo.phoneNumbers.map((phone, i) => (
                  <p key={i} className="text-sm text-slate-600 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {phone}
                  </p>
                ))}
              </div>
            </div>
          )}

          {geo.hasGoogleMaps && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Google Maps embedded
            </p>
          )}

          {geo.addresses.length === 0 && geo.phoneNumbers.length === 0 && (
            <p className="text-sm text-slate-400">No local presence information found</p>
          )}
        </div>
      </AccordionItem>

      {/* Tone & Voice Details */}
      <AccordionItem
        title="Tone & Voice Details"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        }
      >
        <div className="space-y-6">
          {/* Do's and Don'ts */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">Do</h4>
              <ul className="space-y-2">
                {tone.doList.slice(0, 5).map((item, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-3">Don&apos;t</h4>
              <ul className="space-y-2">
                {tone.dontList.slice(0, 5).map((item, i) => (
                  <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">-</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Sample Headlines */}
          {tone.sampleHeadlines.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Sample Headlines</h4>
              <div className="space-y-2">
                {tone.sampleHeadlines.slice(0, 3).map((headline, i) => (
                  <p key={i} className="text-sm text-slate-600 italic border-l-2 border-slate-200 pl-3">
                    &quot;{headline}&quot;
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Sample CTAs */}
          {tone.sampleCtas.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-3">Sample CTAs</h4>
              <div className="flex flex-wrap gap-2">
                {tone.sampleCtas.slice(0, 5).map((cta, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-700"
                  >
                    {cta}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </AccordionItem>

      {/* Marketing Examples */}
      <AccordionItem
        title="Marketing Examples"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
        }
        badge={marketing.elements.length > 0 ? `${marketing.elements.length} found` : undefined}
      >
        <div className="space-y-4">
          {marketing.ctaPatterns.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">CTA Patterns</h4>
              <div className="flex flex-wrap gap-2">
                {marketing.ctaPatterns.slice(0, 8).map((cta, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 text-sm rounded-full"
                    style={{
                      backgroundColor: `${primaryColor}15`,
                      color: primaryColor,
                    }}
                  >
                    {cta}
                  </span>
                ))}
              </div>
            </div>
          )}

          {marketing.elements.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Marketing Elements</h4>
              <div className="space-y-2">
                {marketing.elements.slice(0, 5).map((el, i) => (
                  <div key={i} className="text-sm p-3 bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-400 uppercase">{el.type.replace('_', ' ')}</span>
                    <p className="text-slate-600 mt-1">{el.content.slice(0, 150)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {marketing.elements.length === 0 && marketing.ctaPatterns.length === 0 && (
            <p className="text-sm text-slate-400">No marketing examples found</p>
          )}
        </div>
      </AccordionItem>
    </section>
  )
}
