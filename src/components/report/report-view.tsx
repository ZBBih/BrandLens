'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, GitCompareArrows, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { GeneratedAssets } from '@/lib/extractors/types'
import { applyOverrides, type EditedColorEntry, type EditedFontEntry } from '@/lib/report/overrides'
import type { ReportOverrides, ReportView as ReportViewData } from '@/lib/report/types'
import { HeroSection, brandColors } from './hero-section'
import { BrandLogo, LogoSection } from './logo-section'
import { PaletteSection } from './palette-section'
import { TypographySection } from './typography-section'
import { VoiceSection } from './voice-section'
import { ConsistencySection } from './consistency-section'
import { SeoChannelsSection } from './seo-channels-section'
import { AssetsSection } from './assets-section'
import { InsightsSection } from './insights-section'
import { ExportMenu } from './export-menu'
import { ShareControl } from './share-control'

export type ReportContext = 'live' | 'demo' | 'public'

function timeAgo(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  return `${hours} hour${hours === 1 ? '' : 's'} ago`
}

function stripEditedAt(overrides: ReportOverrides | undefined): ReportOverrides {
  const rest = { ...overrides }
  delete rest.editedAt
  return rest
}

export function ReportView({
  view,
  context,
  partial = false,
  banner,
  onViewChange,
}: {
  view: ReportViewData
  context: ReportContext
  partial?: boolean
  /** Rendered at the top of the main content, e.g. live progress */
  banner?: React.ReactNode
  onViewChange?: (view: ReportViewData) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ReportOverrides>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const base = view.report!
  const report = useMemo(() => applyOverrides(base, editing ? draft : view.overrides), [base, editing, draft, view.overrides])
  const { primary } = brandColors(report)

  const canEdit = context === 'live' && view.isOwner && !partial
  const tonePending = partial && base.tone.traits.length === 0 && base.tone.source === 'not_found'
  const summaryPending = partial && !base.summary.description
  const aiPending = partial

  const startEditing = () => {
    setDraft(stripEditedAt(view.overrides))
    setSaveError(null)
    setEditing(true)
  }

  const saveEdits = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const response = await fetch(`/api/report/${encodeURIComponent(view.id)}/overrides`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {}
      if (!response.ok) {
        setSaveError(data.error ?? 'Your edits could not be saved. Please try again.')
        return
      }
      onViewChange?.(data as ReportViewData)
      setEditing(false)
    } catch {
      setSaveError('Could not reach the server. Your edits are still here; try saving again.')
    } finally {
      setSaving(false)
    }
  }

  const onRegenerated = (assets: GeneratedAssets, regenerationsLeft: number) => {
    onViewChange?.({ ...view, report: { ...base, generatedAssets: assets }, regenerationsLeft })
  }

  return (
    <div className="min-h-screen bg-[#f5f3ef]">
      {/* React 19 hoists this into <head>, so each report tab is named for its brand (A41) */}
      <title>{`${report.brandName} brand guidelines · BrandLens`}</title>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900">
              <ArrowLeft className="size-4" aria-hidden />
              {context === 'public' ? 'BrandLens' : 'Home'}
            </Link>
            <span className="h-4 w-px bg-slate-200" aria-hidden />
            <BrandLogo url={report.logoUrl} alt="" className="h-6 max-w-[6rem] object-contain" />
            <div className="min-w-0">
              {editing ? (
                <label className="flex items-center gap-2 text-sm">
                  <span className="sr-only">Brand name</span>
                  <input
                    value={draft.brandName ?? base.brandName}
                    maxLength={100}
                    onChange={event => setDraft({ ...draft, brandName: event.target.value.replace(/[<>"'`\\{};]/g, '') || undefined })}
                    className="h-8 w-48 rounded-md border px-2 font-semibold"
                  />
                </label>
              ) : (
                <p className="truncate font-semibold text-slate-900">{report.brandName}</p>
              )}
              <p className="truncate text-xs text-slate-600">{report.domain}</p>
            </div>
          </div>

          <nav aria-label="Report actions" className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={saveEdits} disabled={saving} aria-busy={saving}>
                  {saving ? 'Saving…' : 'Save edits'}
                </Button>
              </>
            ) : (
              <>
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    <Pencil aria-hidden />
                    Edit values
                  </Button>
                )}
                {canEdit && (
                  <ShareControl
                    reportId={view.id}
                    isPublic={view.isPublic}
                    sharePath={view.sharePath}
                    onChange={(isPublic, sharePath) => onViewChange?.({ ...view, isPublic, sharePath })}
                  />
                )}
                {context !== 'public' && !partial && (
                  <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                    <Link href={`/compare?brand1=${encodeURIComponent(view.id)}`}>
                      <GitCompareArrows aria-hidden />
                      Compare
                    </Link>
                  </Button>
                )}
                {!partial && <ExportMenu report={report} />}
                <Button asChild size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">
                  <Link href="/">
                    <Plus aria-hidden />
                    {context === 'public' ? 'Analyze your brand' : 'New analysis'}
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {banner}
        {saveError && (
          <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {saveError}
          </p>
        )}
        {editing && (
          <p className="mb-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
            Editing. Changes preview immediately; press Save edits to keep them. The original analysis is never overwritten.
          </p>
        )}
        {context === 'live' && view.cachedFrom && (
          <p className="mb-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
            This report reuses an analysis of {report.domain} from {timeAgo(view.cachedFrom)}, so it didn&apos;t count against your daily limit. It&apos;s your own copy: edits and sharing only affect you.
          </p>
        )}
        {context === 'live' && !view.isOwner && (
          <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">
            You&apos;re viewing an analysis someone else started. <Link href="/" className="font-medium text-indigo-700 underline">Run your own</Link> to edit, regenerate or share it.
          </p>
        )}

        <HeroSection report={report} summaryPending={summaryPending} />
        <LogoSection logoUrl={report.logoUrl} brandName={report.brandName} fromBrandfetch={report.logoUrl?.includes('brandfetch') ?? false} />
        <PaletteSection
          colors={report.colors.colors as EditedColorEntry[]}
          baseColors={base.colors.colors}
          editing={editing}
          draft={draft.colors ?? {}}
          onDraftChange={colors => setDraft({ ...draft, colors })}
        />
        <TypographySection
          typography={report.typography as typeof report.typography & { fonts: EditedFontEntry[] }}
          baseFonts={base.typography.fonts}
          editing={editing}
          draft={draft.fonts ?? {}}
          onDraftChange={fonts => setDraft({ ...draft, fonts })}
        />
        <VoiceSection tone={report.tone} primary={primary} pending={tonePending} />
        <ConsistencySection consistency={report.consistency} pending={partial && !report.consistency} />
        <SeoChannelsSection seo={report.seo} social={report.social} geo={report.geo} />
        <AssetsSection
          reportId={view.id}
          assets={report.generatedAssets}
          primary={primary}
          pending={aiPending}
          canRegenerate={canEdit}
          regenerationsLeft={view.regenerationsLeft}
          onRegenerated={onRegenerated}
        />
        <InsightsSection insights={report.aiInsights} primary={primary} pending={aiPending} />

        <p className="py-8 text-center text-sm text-slate-700">
          Analysed {report.crawlStats.pagesProcessed} {report.crawlStats.pagesProcessed === 1 ? 'page' : 'pages'} in {report.crawlStats.duration.toFixed(0)}s
        </p>
      </main>
    </div>
  )
}
