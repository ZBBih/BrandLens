'use client'

import { ConsistencyData, SeoData } from '@/lib/extractors/types'

interface ScoreAndActionsProps {
  consistency?: ConsistencyData
  seo: SeoData
  primaryColor: string
}

interface PriorityAction {
  title: string
  detail: string
  severity: 'high' | 'medium'
}

function CircularProgress({ score, grade }: { score: number; grade: string }) {
  const circumference = 2 * Math.PI * 56
  const offset = circumference - (score / 100) * circumference

  const getGradeColor = (g: string) => {
    switch (g) {
      case 'A': return '#22C55E'
      case 'B': return '#84CC16'
      case 'C': return '#EAB308'
      case 'D': return '#F97316'
      case 'F': return '#EF4444'
      default: return '#6B7280'
    }
  }

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="56"
          stroke="#E5E7EB"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="64"
          cy="64"
          r="56"
          stroke={getGradeColor(grade)}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-5xl font-bold text-slate-900">{grade}</span>
      </div>
    </div>
  )
}

export function ScoreAndActions({ consistency, seo, primaryColor }: ScoreAndActionsProps) {
  // Build priority actions from SEO issues and consistency issues
  const actions: PriorityAction[] = []

  // Add SEO issues
  const seoIssues = seo.issues || []
  for (const issue of seoIssues.slice(0, 2)) {
    actions.push({
      title: issue.headline,
      detail: issue.action || issue.detail,
      severity: issue.status === 'bad' ? 'high' : 'medium',
    })
  }

  // Add consistency issues
  if (consistency?.issues) {
    for (const issue of consistency.issues.slice(0, 3 - actions.length)) {
      actions.push({
        title: issue,
        detail: 'Improve brand consistency',
        severity: 'medium',
      })
    }
  }

  // If no issues, show a success message
  const hasIssues = actions.length > 0

  const score = consistency?.score ?? 75
  const grade = consistency?.grade ?? 'B'

  return (
    <section className="grid md:grid-cols-5 gap-6 mb-6">
      {/* Score - Takes 2 columns */}
      <div className="md:col-span-2 bg-white rounded-2xl shadow-lg p-6 text-center">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
          Brand Consistency
        </h3>

        <CircularProgress score={score} grade={grade} />

        <p className="text-slate-600 mt-4 font-semibold">{score} / 100</p>
        <p className="text-sm text-slate-400 mt-1">
          {score >= 80
            ? 'Excellent brand consistency'
            : score >= 60
              ? 'Good, with room to improve'
              : 'Needs attention'}
        </p>
      </div>

      {/* Priority Actions - Takes 3 columns */}
      <div className="md:col-span-3 bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
          Fix These First
        </h3>

        {hasIssues ? (
          <div className="space-y-3">
            {actions.slice(0, 3).map((action, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  action.severity === 'high'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <span
                  className={`font-bold text-sm w-6 h-6 rounded-full flex items-center justify-center ${
                    action.severity === 'high'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{action.title}</p>
                  <p className="text-sm text-slate-600 line-clamp-2">{action.detail}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-slate-700">Looking Great!</p>
            <p className="text-sm text-slate-500 mt-1">No major issues found</p>
          </div>
        )}
      </div>
    </section>
  )
}
