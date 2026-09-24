import type { AIInsights } from '@/lib/extractors/types'
import { readableTextOn } from '@/lib/color-contrast'
import { Section, SectionSkeleton } from './section'

export function InsightsSection({ insights, primary, pending }: { insights?: AIInsights; primary: string; pending: boolean }) {
  if (!pending && !insights) return null

  return (
    <Section id="insights" title="AI Insights" className="mb-6" aside={<span className="text-sm text-slate-600">Written by Claude from the data above</span>}>
      {pending || !insights ? (
        <SectionSkeleton label="Strategic insights" lines={5} />
      ) : (
        <>
          <div className="mb-8">
            <h3 className="mb-3 text-lg font-semibold text-slate-900">Executive summary</h3>
            <div className="rounded-xl bg-slate-50 p-6">
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{insights.executiveSummary}</p>
            </div>
          </div>

          {insights.actionItems.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Recommended actions</h3>
              <ol className="space-y-3 rounded-xl bg-slate-50 p-6">
                {insights.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ backgroundColor: primary, color: readableTextOn(primary) }}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-800">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
            {insights.scoreExplanation && (
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-900">About the score</h3>
                <p className="rounded-xl bg-slate-50 p-6 text-sm leading-relaxed text-slate-800">{insights.scoreExplanation}</p>
              </div>
            )}
            {insights.competitorPositioning && (
              <div>
                <h3 className="mb-3 text-lg font-semibold text-slate-900">Market positioning</h3>
                <p className="rounded-xl bg-slate-50 p-6 text-sm leading-relaxed text-slate-800">{insights.competitorPositioning}</p>
              </div>
            )}
          </div>
        </>
      )}
    </Section>
  )
}
