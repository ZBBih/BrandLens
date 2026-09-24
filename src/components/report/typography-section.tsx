'use client'

import { useState } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import type { FontEntry, TypographyData } from '@/lib/extractors/types'
import type { EditedFontEntry } from '@/lib/report/overrides'
import type { ReportOverrides } from '@/lib/report/types'
import { Section } from './section'
import { SourceBadge } from './source-badge'
import { EvidencePopover } from './evidence-popover'

type FontDraft = NonNullable<ReportOverrides['fonts']>
const INITIAL_COUNT = 3

const ROLE_NAMES: Record<string, string> = {
  heading: 'Headings',
  primary: 'Body text',
  button: 'Buttons',
  secondary: 'Secondary',
  accent: 'Accent',
}

/** Font names come from third-party sites; keep only characters safe inside a CSS string */
function cssFontFamily(name: string): string {
  return `"${name.replace(/["\\<>;{}]/g, '')}", sans-serif`
}

function safeHttpsUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

function FontCard({ font }: { font: EditedFontEntry }) {
  const googleUrl = safeHttpsUrl(font.googleFontsUrl)
  return (
    <li className="rounded-xl bg-slate-50 p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <SourceBadge source={font.source} edited={font.userEdited} />
        <EvidencePopover subject={`Font ${font.name}`} source={font.source} confidence={font.confidence} evidence={font.evidence} edited={font.userEdited} />
      </div>
      <p className="mb-2 text-4xl font-bold text-slate-900" style={{ fontFamily: cssFontFamily(font.name) }} aria-hidden>
        AaBb
      </p>
      <h3 className="font-semibold text-slate-900 break-words">{font.name}</h3>
      <p className="mb-2 text-sm text-slate-700">{ROLE_NAMES[font.role] ?? font.role}</p>

      {font.variants && font.variants.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-slate-700">Weights</p>
          <ul className="flex flex-wrap gap-1">
            {font.variants.map(variant => (
              <li key={variant} className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-800">
                {variant}
              </li>
            ))}
          </ul>
        </div>
      )}

      {googleUrl && (
        <a href={googleUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-indigo-700 hover:text-indigo-900">
          <ExternalLink className="size-3.5" aria-hidden />
          View on Google Fonts
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </li>
  )
}

function FontEditor({ font, draft, onChange }: { font: FontEntry; draft: FontDraft; onChange: (next: FontDraft) => void }) {
  const edit = draft[font.name] ?? {}
  const inputId = `font-${font.name.replace(/[^a-zA-Z0-9]/g, '-')}`

  const update = (patch: FontDraft[string]) => {
    const merged = { ...edit, ...patch }
    const next = { ...draft }
    if (!merged.hidden && (!merged.name || merged.name === font.name)) delete next[font.name]
    else next[font.name] = merged
    onChange(next)
  }

  return (
    <li className={`flex flex-wrap items-end gap-3 rounded-xl border p-3 ${edit.hidden ? 'opacity-60' : ''}`}>
      <div className="flex min-w-[12rem] flex-1 flex-col">
        <label htmlFor={inputId} className="text-xs font-medium text-slate-700">
          Font name (was {font.name})
        </label>
        <input
          id={inputId}
          defaultValue={edit.name ?? font.name}
          maxLength={100}
          onChange={event => update({ name: event.target.value.replace(/[<>"'`\\{};]/g, '').trim() || undefined })}
          autoComplete="off"
          className="mt-1 h-9 rounded-md border px-2 text-sm"
        />
      </div>
      <label className="flex min-h-9 items-center gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={!!edit.hidden} onChange={event => update({ hidden: event.target.checked })} className="size-4" />
        Hide
      </label>
    </li>
  )
}

export function TypographySection({
  typography,
  baseFonts,
  editing,
  draft,
  onDraftChange,
}: {
  typography: TypographyData & { fonts: EditedFontEntry[] }
  baseFonts: FontEntry[]
  editing: boolean
  draft: FontDraft
  onDraftChange: (next: FontDraft) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const fonts = typography.fonts
  const visible = showAll ? fonts : fonts.slice(0, INITIAL_COUNT)

  return (
    <Section
      id="typography"
      title="Typography"
      className="mb-6"
      aside={
        <div className="flex items-center gap-3">
          {typography.googleFontsDetected && <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800">Uses Google Fonts</span>}
          <span className="text-sm text-slate-600">
            {fonts.length} {fonts.length === 1 ? 'font' : 'fonts'}
          </span>
        </div>
      }
    >
      {editing ? (
        <>
          <p className="mb-4 text-sm text-slate-700">Rename a font that was detected under the wrong name, or hide one that isn&apos;t part of the brand.</p>
          <ul className="space-y-3">
            {baseFonts.map(font => (
              <FontEditor key={font.name} font={font} draft={draft} onChange={onDraftChange} />
            ))}
          </ul>
        </>
      ) : fonts.length === 0 ? (
        <p className="text-slate-700">No custom fonts were detected. The site appears to use system fonts.</p>
      ) : (
        <>
          <ul id="font-list" className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
            {visible.map((font, index) => (
              <FontCard key={`${font.name}-${index}`} font={font} />
            ))}
          </ul>
          {fonts.length > INITIAL_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              aria-expanded={showAll}
              aria-controls="font-list"
              className="mt-6 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <ChevronDown className={`size-4 transition-transform ${showAll ? 'rotate-180' : ''}`} aria-hidden />
              {showAll ? 'Show fewer fonts' : `Show all ${fonts.length} fonts`}
            </button>
          )}
          {typography.nonInspectableTextWarning && <p className="mt-4 text-sm text-amber-900">{typography.nonInspectableTextWarning}</p>}
        </>
      )}
    </Section>
  )
}
