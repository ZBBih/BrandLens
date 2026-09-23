'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ColorEntry } from '@/lib/extractors/types'
import type { EditedColorEntry } from '@/lib/report/overrides'
import { colorKey } from '@/lib/report/overrides'
import type { ReportOverrides } from '@/lib/report/types'
import { readableTextOn, safeHex } from '@/lib/color-contrast'
import { Section } from './section'
import { SourceBadge } from './source-badge'
import { EvidencePopover } from './evidence-popover'
import { CopyButton } from './copy-button'

const ROLES: ColorEntry['role'][] = ['primary', 'secondary', 'accent', 'background', 'text', 'other']
const INITIAL_COUNT = 6

type ColorDraft = NonNullable<ReportOverrides['colors']>

function Swatch({ color }: { color: EditedColorEntry }) {
  const hex = safeHex(color.hex, '#000000')
  return (
    <li className="min-w-[130px] flex-1 basis-[130px]">
      <div
        className="mb-3 flex h-28 items-end rounded-lg p-3 ring-1 ring-inset ring-black/10"
        style={{ backgroundColor: hex, color: readableTextOn(hex) }}
      >
        <span className="text-xs font-semibold capitalize">{color.role}</span>
      </div>
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <p className="font-mono text-sm font-medium text-slate-900">{hex.toUpperCase()}</p>
          <SourceBadge source={color.source} edited={color.userEdited} className="mt-1" />
        </div>
        <EvidencePopover
          subject={`Color ${hex.toUpperCase()}`}
          source={color.source}
          confidence={color.confidence}
          evidence={color.evidence}
          edited={color.userEdited}
        />
      </div>
      <CopyButton text={hex.toUpperCase()} label={`color ${hex.toUpperCase()}`} className="-ml-2 mt-1" />
    </li>
  )
}

function ColorEditor({ color, draft, onChange }: { color: ColorEntry; draft: ColorDraft; onChange: (next: ColorDraft) => void }) {
  const key = colorKey(color)
  const edit = draft[key] ?? {}
  const [hexText, setHexText] = useState(edit.hex ?? color.hex.toLowerCase())
  const valid = /^#[0-9a-f]{6}$/i.test(hexText)
  const inputId = `color-${key.slice(1)}`

  const update = (patch: ColorDraft[string]) => {
    const merged = { ...edit, ...patch }
    const next = { ...draft }
    const isNoop = !merged.hidden && (!merged.hex || merged.hex === key) && (!merged.role || merged.role === color.role)
    if (isNoop) delete next[key]
    else next[key] = merged
    onChange(next)
  }

  return (
    <li className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${edit.hidden ? 'opacity-60' : ''}`}>
      <span className="size-10 shrink-0 rounded-md ring-1 ring-inset ring-black/10" style={{ backgroundColor: valid ? hexText : color.hex }} aria-hidden />
      <div className="flex min-w-[9rem] flex-1 flex-col">
        <label htmlFor={inputId} className="text-xs font-medium text-slate-700">
          Hex (was {color.hex.toUpperCase()})
        </label>
        <input
          id={inputId}
          value={hexText}
          onChange={event => {
            const value = event.target.value.trim()
            setHexText(value)
            if (/^#[0-9a-f]{6}$/i.test(value)) update({ hex: value.toLowerCase() })
          }}
          aria-invalid={!valid}
          aria-describedby={valid ? undefined : `${inputId}-error`}
          spellCheck={false}
          autoComplete="off"
          className="mt-1 h-9 rounded-md border px-2 font-mono text-sm"
        />
        {!valid && (
          <p id={`${inputId}-error`} className="mt-1 text-xs text-red-700">
            Use six-digit hex, like #1a2b3c
          </p>
        )}
      </div>
      <div className="flex flex-col">
        <label htmlFor={`${inputId}-role`} className="text-xs font-medium text-slate-700">
          Role
        </label>
        <select
          id={`${inputId}-role`}
          value={edit.role ?? color.role}
          onChange={event => update({ role: event.target.value as ColorEntry['role'] })}
          className="mt-1 h-9 rounded-md border bg-white px-2 text-sm capitalize"
        >
          {ROLES.map(role => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-9 items-center gap-2 self-end text-sm text-slate-800">
        <input type="checkbox" checked={!!edit.hidden} onChange={event => update({ hidden: event.target.checked })} className="size-4" />
        Hide
      </label>
    </li>
  )
}

export function PaletteSection({
  colors,
  baseColors,
  editing,
  draft,
  onDraftChange,
}: {
  colors: EditedColorEntry[]
  baseColors: ColorEntry[]
  editing: boolean
  draft: ColorDraft
  onDraftChange: (next: ColorDraft) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? colors : colors.slice(0, INITIAL_COUNT)

  return (
    <Section
      id="palette"
      title="Palette"
      className="mb-6"
      aside={<span className="text-sm text-slate-600">{colors.length} {colors.length === 1 ? 'color' : 'colors'}</span>}
    >
      {editing ? (
        <>
          <p className="mb-4 text-sm text-slate-700">Correct any color the analysis got wrong. Exports and the shared report use your edits.</p>
          <ul className="space-y-3">
            {baseColors.map(color => (
              <ColorEditor key={colorKey(color)} color={color} draft={draft} onChange={onDraftChange} />
            ))}
          </ul>
        </>
      ) : colors.length === 0 ? (
        <p className="text-slate-700">No brand colors could be identified on this site.</p>
      ) : (
        <>
          <ul id="palette-list" className="flex flex-wrap gap-4">
            {visible.map(color => (
              <Swatch key={`${color.hex}-${color.role}`} color={color} />
            ))}
          </ul>
          {colors.length > INITIAL_COUNT && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              aria-expanded={showAll}
              aria-controls="palette-list"
              className="mt-6 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-900"
            >
              <ChevronDown className={`size-4 transition-transform ${showAll ? 'rotate-180' : ''}`} aria-hidden />
              {showAll ? 'Show fewer colors' : `Show all ${colors.length} colors`}
            </button>
          )}
        </>
      )}
    </Section>
  )
}
