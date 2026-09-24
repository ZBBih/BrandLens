'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { GeneratedAssets } from '@/lib/extractors/types'
import { Button } from '@/components/ui/button'
import { readableTextOn } from '@/lib/color-contrast'
import { CopyButton } from './copy-button'
import { Eyebrow, Section, SectionSkeleton } from './section'

const PREVIEW_LENGTH = 220

function Post({ id, platform, text }: { id: string; platform: string; text: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = text.length > PREVIEW_LENGTH

  return (
    <article aria-labelledby={`${id}-label`} className="flex flex-col rounded-xl bg-slate-50 p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 id={`${id}-label`} className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          {platform}
        </h3>
        <CopyButton text={text} label={`${platform} post`} />
      </div>
      <p id={`${id}-text`} className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
        {expanded || !isLong ? text : `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…`}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-controls={`${id}-text`}
          className="mt-2 self-start text-sm font-medium text-indigo-700 underline-offset-4 hover:underline"
        >
          {expanded ? 'Show less' : 'Read full post'}
        </button>
      )}
    </article>
  )
}

function Chips({ title, items, style }: { title: string; items: string[]; style?: React.CSSProperties }) {
  if (items.length === 0) return null
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Eyebrow className="mb-0">{title}</Eyebrow>
        <CopyButton text={items.join('\n')} label={title.toLowerCase()} />
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <li key={i} className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-900" style={style}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AssetsSection({
  reportId,
  assets,
  primary,
  pending,
  canRegenerate,
  regenerationsLeft,
  onRegenerated,
}: {
  reportId: string
  assets?: GeneratedAssets
  primary: string
  pending: boolean
  canRegenerate: boolean
  regenerationsLeft: number
  onRegenerated: (assets: GeneratedAssets, regenerationsLeft: number) => void
}) {
  const [regenerating, setRegenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const regenerate = async () => {
    if (regenerating) return
    setRegenerating(true)
    setError(null)
    setAnnouncement('Writing new marketing copy…')
    try {
      const response = await fetch(`/api/report/${encodeURIComponent(reportId)}/regenerate-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {}
      if (!response.ok || !data.assets) {
        setError(data.error ?? 'The copy could not be regenerated. Please try again.')
        setAnnouncement('')
        return
      }
      onRegenerated(data.assets, data.regenerationsLeft)
      setAnnouncement('New marketing copy is ready.')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
      setAnnouncement('')
    } finally {
      setRegenerating(false)
    }
  }

  if (!pending && !assets) {
    return (
      <Section id="assets" title="Marketing Copy" className="mb-6">
        <p className="text-slate-700">AI copywriting was unavailable for this report.</p>
      </Section>
    )
  }

  const ctaText = readableTextOn(primary)

  return (
    <Section
      id="assets"
      title="Marketing Copy"
      className="mb-6"
      aside={
        canRegenerate && assets ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-slate-600">{regenerationsLeft} of 3 regenerations left</span>
            <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating || regenerationsLeft === 0} aria-busy={regenerating}>
              <RefreshCw className={regenerating ? 'motion-safe:animate-spin' : ''} aria-hidden />
              {regenerating ? 'Writing…' : 'Regenerate'}
            </Button>
          </div>
        ) : undefined
      }
    >
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {pending || !assets ? (
        <SectionSkeleton label="Marketing copy" />
      ) : (
        <>
          {assets.elevatorPitch && (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-2 rounded-xl border p-5">
              <div>
                <Eyebrow className="mb-2">Elevator pitch</Eyebrow>
                <p className="text-lg text-slate-900">{assets.elevatorPitch}</p>
              </div>
              <CopyButton text={assets.elevatorPitch} label="elevator pitch" />
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-3 [&>*]:min-w-0">
            <Post id="linkedin-post" platform="LinkedIn" text={assets.linkedinPost} />
            <Post id="instagram-post" platform="Instagram" text={assets.instagramPost} />
            <Post id="x-post" platform="X (Twitter)" text={assets.twitterPost} />
          </div>
          <Chips title="Ad headlines" items={assets.adHeadlines} />
          <Chips title="Email subject lines" items={assets.emailSubjects} />
          <Chips title="Calls to action" items={assets.ctaVariations} style={{ backgroundColor: primary, color: ctaText }} />
        </>
      )}
    </Section>
  )
}
