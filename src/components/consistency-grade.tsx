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
  const [showMethodology, setShowMethodology] = useState(false)

  const tooltips: Record<keyof ConsistencyBreakdown, string> = {
    color: 'How consistently your brand colors appear across all pages',
    typography: 'Font consistency across your website pages',
    tone: 'Voice and messaging style consistency',
    seo: 'Title tags, meta descriptions, and H1 patterns',
    message: 'Core messaging reinforcement across pages',
  }

  const getIssuePriority = (issue: string) => {
    const lowercaseIssue = issue.toLowerCase()
    if (lowercaseIssue.includes('only') && lowercaseIssue.includes('%')) {
      const match = lowercaseIssue.match(/(\d+)%/)
      if (match) {
        const percentage = parseInt(match[1])
        if (percentage < 50) return 'high'
        if (percentage < 70) return 'medium'
      }
    }
    if (lowercaseIssue.includes('missing') || lowercaseIssue.includes('no ')) return 'high'
    if (lowercaseIssue.includes('inconsistent') || lowercaseIssue.includes('vary')) return 'medium'
    return 'low'
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return { bg: 'bg-red-100', text: 'text-red-700', label: 'High Impact' }
      case 'medium':
        return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' }
      default:
        return { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Low' }
    }
  }

  const getImprovementTip = (breakdown: ConsistencyBreakdown) => {
    const lowest = Object.entries(breakdown).reduce((min, [key, value]) => {
      const maxScores: Record<string, number> = { color: 25, typography: 20, tone: 25, seo: 15, message: 15 }
      const percentage = (value / maxScores[key]) * 100
      if (percentage < min.percentage) {
        return { key, percentage }
      }
      return min
    }, { key: '', percentage: 100 })

    switch (lowest.key) {
      case 'color':
        return 'Focus on using your primary brand colors consistently across all pages.'
      case 'typography':
        return 'Ensure the same fonts are used across your entire website.'
      case 'tone':
        return 'Maintain consistent voice and messaging style on all pages.'
      case 'seo':
        return 'Standardize your title tags and meta descriptions format.'
      case 'message':
        return 'Reinforce your core value proposition on every page.'
      default:
        return 'Keep improving your brand consistency across all areas.'
    }
  }

  return (
    <div className="bg-white rounded-2xl border p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-blue-500" />
          <h2 className="text-2xl font-semibold text-slate-800">Brand Health Score</h2>
        </div>
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="text-xs text-slate-500 hover:text-slate-700 underline"
        >
          How we calculate
        </button>
      </div>

      {showMethodology && (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
          <p className="font-medium text-slate-700 mb-2">Scoring Methodology</p>
          <ul className="space-y-1 text-xs">
            <li><span className="font-medium">Color (25 pts):</span> % of pages using brand colors, minus penalties for off-brand colors</li>
            <li><span className="font-medium">Typography (20 pts):</span> % of pages using consistent brand fonts</li>
            <li><span className="font-medium">Tone (25 pts):</span> Voice consistency between homepage, about, and blog pages</li>
            <li><span className="font-medium">SEO (15 pts):</span> Title/description patterns, H1 usage, and duplicate detection</li>
            <li><span className="font-medium">Message (15 pts):</span> Core value proposition reinforcement across pages</li>
          </ul>
        </div>
      )}

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

      {/* Quick Tip */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg flex items-start gap-3">
        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-blue-800">Quick Win</p>
          <p className="text-sm text-blue-700">{getImprovementTip(data.breakdown)}</p>
        </div>
      </div>

      {/* Issues Section */}
      {data.issues.length > 0 && (
        <div className="mt-6 pt-6 border-t">
          <button
            onClick={() => setShowIssues(!showIssues)}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showIssues ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Issues Found ({data.issues.length})
          </button>

          {showIssues && (
            <div className="mt-4 space-y-3">
              {data.issues.map((issue, i) => {
                const priority = getIssuePriority(issue)
                const badge = getPriorityBadge(priority)
                return (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge.bg} ${badge.text} flex-shrink-0`}>
                      {badge.label}
                    </span>
                    <p className="text-sm text-slate-700">{issue}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
