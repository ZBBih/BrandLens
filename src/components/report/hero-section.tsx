'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { BrandReport } from '@/lib/extractors/types'
import { readableTextOn, safeHex } from '@/lib/color-contrast'
import { SectionSkeleton } from './section'

export function brandColors(report: BrandReport) {
  const primary = safeHex(report.colors.colors.find(c => c.role === 'primary')?.hex ?? report.colors.colors[0]?.hex, '#4338ca')
  const secondary = safeHex(
    report.colors.colors.find(c => c.role === 'secondary')?.hex ??
      report.colors.colors.find(c => c.hex.toLowerCase() !== primary && c.role !== 'background' && c.role !== 'text')?.hex,
    '#1e293b'
  )
  return { primary, secondary }
}

function formatDate(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function HeroSection({ report, summaryPending }: { report: BrandReport; summaryPending: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { primary, secondary } = brandColors(report)
  const onPrimary = readableTextOn(primary)
  const onSecondary = readableTextOn(secondary)
  const description = report.summary.description
  const isLong = description.length > 220

  return (
    <div className="mb-6 grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
      <div className="flex min-h-[220px] flex-col justify-end rounded-2xl p-6 sm:min-h-[280px] sm:p-10" style={{ backgroundColor: primary, color: onPrimary }}>
        <h1 className="text-4xl font-bold leading-tight break-words sm:text-5xl">
          <span className="sr-only">{report.brandName} </span>
          Brand
          <br />
          Guidelines
        </h1>
        <p className="mt-4 text-sm font-medium break-words">
          {report.brandName}
          {formatDate(report.generatedAt) && <> · {formatDate(report.generatedAt)}</>}
        </p>
      </div>

      <section
        aria-labelledby="summary-heading"
        className="flex min-h-[220px] flex-col rounded-2xl p-6 sm:min-h-[280px] sm:p-10"
        style={{ backgroundColor: secondary, color: onSecondary }}
      >
        <h2 id="summary-heading" className="mb-4 text-sm font-semibold uppercase tracking-wider">
          Brand Summary
        </h2>
        {summaryPending ? (
          <div className="rounded-xl bg-white p-4 text-slate-900">
            <SectionSkeleton label="The brand summary" lines={3} />
          </div>
        ) : (
          <div className="flex-1">
            {description ? (
              <>
                <p id="summary-text" className="text-base leading-relaxed">
                  {expanded || !isLong ? description : `${description.slice(0, 220).trimEnd()}…`}
                </p>
                {isLong && (
                  <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    aria-expanded={expanded}
                    aria-controls="summary-text"
                    className="mt-2 inline-flex min-h-8 items-center gap-1 text-sm font-medium underline underline-offset-4"
                  >
                    {expanded ? 'Show less' : 'Show more'}
                    <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
                  </button>
                )}
              </>
            ) : (
              <p className="text-base">No description could be found for this brand.</p>
            )}

            {report.summary.valueProposition && (
              <div className="mt-4 border-t pt-4" style={{ borderColor: `${onSecondary}33` }}>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider">Value Proposition</h3>
                <p className="text-sm italic">&ldquo;{report.summary.valueProposition}&rdquo;</p>
              </div>
            )}

            {report.summary.industry && (
              <p className="mt-3">
                <span className="inline-block rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: `${onSecondary}66` }}>
                  {report.summary.industry}
                </span>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
