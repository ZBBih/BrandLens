'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ConsistencyGrade } from '@/lib/extractors/types'
import { CONSISTENCY_DIMENSIONS, CONSISTENCY_LABELS, normalizeConsistencyData } from '@/lib/export/consistency'
import { Section, SectionSkeleton } from './section'

const DESCRIPTIONS: Record<string, string> = {
  color: 'How consistently the brand colors appear across pages',
  typography: 'Whether pages use the same brand fonts',
  tone: 'How steady the voice and messaging style is',
  seo: 'Consistency of titles, descriptions and headings',
  message: 'How often the core message is repeated across pages',
}

// Text colors are the -800 shades so the grade letter itself meets AA contrast (A32)
const GRADE_STYLES: Record<ConsistencyGrade, { ring: string; text: string; label: string }> = {
  A: { ring: '#16a34a', text: 'text-green-800', label: 'Very consistent brand' },
  B: { ring: '#65a30d', text: 'text-lime-800', label: 'Minor inconsistencies' },
  C: { ring: '#ca8a04', text: 'text-yellow-800', label: 'Noticeable inconsistencies' },
  D: { ring: '#ea580c', text: 'text-orange-800', label: 'Significant inconsistencies' },
  F: { ring: '#dc2626', text: 'text-red-800', label: 'Brand needs attention' },
}

function barColor(fraction: number) {
  if (fraction >= 0.8) return 'bg-green-600'
  if (fraction >= 0.6) return 'bg-yellow-500'
  return 'bg-red-600'
}

function GradeRing({ grade, score }: { grade: ConsistencyGrade; score: number }) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const style = GRADE_STYLES[grade]
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg className="-rotate-90" width="150" height="150" aria-hidden focusable="false">
          <circle cx="75" cy="75" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke={style.ring}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - (score / 100) * circumference}
          />
        </svg>
        <p className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl font-bold ${style.text}`}>
            <span className="sr-only">Grade </span>
            {grade}
          </span>
          <span className="text-sm text-slate-700">{score}/100</span>
        </p>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800">{style.label}</p>
    </div>
  )
}

export function ConsistencySection({ consistency, pending }: { consistency: unknown; pending: boolean }) {
  const [showIssues, setShowIssues] = useState(false)
  const data = normalizeConsistencyData(consistency)

  if (!pending && !data) return null

  return (
    <Section id="consistency" title="Brand Consistency" className="mb-6">
      {pending || !data ? (
        <SectionSkeleton label="The consistency score" />
      ) : (
        <>
          <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
            {data.grade && data.score !== null ? (
              <GradeRing grade={data.grade} score={data.score} />
            ) : (
              <div className="flex size-[150px] flex-col items-center justify-center rounded-full border-[12px] border-slate-200 text-center">
                <span className="px-2 text-sm font-semibold text-slate-800">No grade</span>
                <span className="px-3 text-xs text-slate-700">Not enough data</span>
              </div>
            )}

            <ul className="space-y-4">
              {CONSISTENCY_DIMENSIONS.map(dim => {
                const item = data.breakdown[dim]
                const scored = item.status === 'scored' && item.score !== null
                const fraction = scored ? Math.max(0, Math.min(1, item.score! / item.max)) : 0
                return (
                  <li key={dim}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-slate-900">{CONSISTENCY_LABELS[dim]}</span>
                      <span className="text-sm text-slate-800">{scored ? `${item.score}/${item.max}` : 'Not enough data'}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                      {scored && <div className={`h-full ${barColor(fraction)}`} style={{ width: `${fraction * 100}%` }} />}
                    </div>
                    <p className="mt-1 text-xs text-slate-700">{scored ? DESCRIPTIONS[dim] : (item.reason ?? DESCRIPTIONS[dim])}</p>
                  </li>
                )
              })}
            </ul>
          </div>

          {data.insufficientData.length > 0 && (
            <div className="mt-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-800">
              <p className="font-semibold">Why some parts weren&apos;t scored</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.insufficientData.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {data.issues.length > 0 && (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setShowIssues(!showIssues)}
                aria-expanded={showIssues}
                aria-controls="consistency-issues"
                className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-800 hover:text-slate-950"
              >
                <ChevronDown className={`size-4 transition-transform ${showIssues ? 'rotate-180' : ''}`} aria-hidden />
                {showIssues ? 'Hide' : 'Show'} {data.issues.length} {data.issues.length === 1 ? 'issue' : 'issues'} found
              </button>
              {showIssues && (
                <ul id="consistency-issues" className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-800">
                  {data.issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <details className="mt-6 text-sm text-slate-800">
            <summary className="cursor-pointer font-semibold">How this score works</summary>
            <p className="mt-2">
              Each dimension is scored from the pages that were analyzed ({data.pagesAnalyzed}). Dimensions without enough evidence are left out
              rather than given full marks, and the total is scaled over the dimensions that could be scored. A letter grade needs at least three
              pages and three scored dimensions.
            </p>
          </details>
        </>
      )}
    </Section>
  )
}
