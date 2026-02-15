'use client'

import { useState } from 'react'
import { ConsistencyData, ConsistencyBreakdown } from '@/lib/extractors/types'

interface ConsistencyGradeProps {
  data: ConsistencyData
}

interface BreakdownBarProps {
  label: string
  score: number
  maxScore: number
  tooltip?: string
}

function BreakdownBar({ label, score, maxScore, tooltip }: BreakdownBarProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const percentage = Math.round((score / maxScore) * 100)
  const width = `${percentage}%`

  const getColor = () => {
    if (percentage >= 80) return 'bg-green-500'
    if (percentage >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-600 flex items-center gap-1">
          {label}
          {tooltip && (
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </span>
        <span className="text-sm font-medium text-slate-700">
          {score}/{maxScore}
        </span>
      </div>
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-500`}
          style={{ width }}
        />
      </div>
      {showTooltip && tooltip && (
        <div className="absolute left-0 top-full mt-2 z-10 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-lg max-w-xs">
          {tooltip}
        </div>
      )}
    </div>
  )
}

function GradeRing({ grade, score }: { grade: string; score: number }) {
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const getGradeColor = () => {
    switch (grade) {
      case 'A': return { ring: '#22c55e', bg: 'bg-green-50', text: 'text-green-600' }
      case 'B': return { ring: '#84cc16', bg: 'bg-lime-50', text: 'text-lime-600' }
      case 'C': return { ring: '#eab308', bg: 'bg-yellow-50', text: 'text-yellow-600' }
      case 'D': return { ring: '#f97316', bg: 'bg-orange-50', text: 'text-orange-600' }
      default: return { ring: '#ef4444', bg: 'bg-red-50', text: 'text-red-600' }
    }
  }

  const colors = getGradeColor()

  const getGradeDescription = () => {
    switch (grade) {
      case 'A': return 'Rock solid brand'
      case 'B': return 'Minor inconsistencies'
      case 'C': return 'Noticeable issues'
      case 'D': return 'Significant problems'
      default: return 'Brand needs work'
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg className="transform -rotate-90" width="150" height="150">
          {/* Background circle */}
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="12"
          />
          {/* Progress circle */}
          <circle
            cx="75"
            cy="75"
            r={radius}
            fill="none"
            stroke={colors.ring}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-5xl font-bold ${colors.text}`}>{grade}</span>
          <span className="text-sm text-slate-500">{score}/100</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-slate-600">{getGradeDescription()}</p>
    </div>
  )
}

export function ConsistencyGrade({ data }: ConsistencyGradeProps) {
  const [showIssues, setShowIssues] = useState(false)

  const tooltips: Record<keyof ConsistencyBreakdown, string> = {
    color: 'How consistently your brand colors appear across all pages',
    typography: 'Font consistency across your website pages',
    tone: 'Voice and messaging style consistency',
    seo: 'Title tags, meta descriptions, and H1 patterns',
    message: 'Core messaging reinforcement across pages',
  }

  return (
    <div className="bg-white rounded-2xl border p-8 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-blue-500" />
        <h2 className="text-2xl font-semibold text-slate-800">Brand Health Score</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Grade Ring */}
        <div className="flex justify-center">
          <GradeRing grade={data.grade} score={data.score} />
        </div>

        {/* Breakdown */}
        <div className="space-y-4">
          <BreakdownBar
            label="Color Consistency"
            score={data.breakdown.color}
            maxScore={25}
            tooltip={tooltips.color}
          />
          <BreakdownBar
            label="Typography"
            score={data.breakdown.typography}
            maxScore={20}
            tooltip={tooltips.typography}
          />
          <BreakdownBar
            label="Tone & Voice"
            score={data.breakdown.tone}
            maxScore={25}
            tooltip={tooltips.tone}
          />
          <BreakdownBar
            label="SEO Patterns"
            score={data.breakdown.seo}
            maxScore={15}
            tooltip={tooltips.seo}
          />
          <BreakdownBar
            label="Message Consistency"
            score={data.breakdown.message}
            maxScore={15}
            tooltip={tooltips.message}
          />

          <div className="pt-4 border-t mt-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Overall</span>
              <span className="font-bold text-lg text-slate-800">{data.score}/100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Issues Section */}
      {data.issues.length > 0 && (
        <div className="mt-8 pt-6 border-t">
          <button
            onClick={() => setShowIssues(!showIssues)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showIssues ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            What&apos;s hurting your score? ({data.issues.length} issues)
          </button>

          {showIssues && (
            <ul className="mt-4 space-y-2 pl-6">
              {data.issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="text-orange-500 mt-0.5">!</span>
                  {issue}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
