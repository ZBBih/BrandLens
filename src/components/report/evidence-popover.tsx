'use client'

import { Popover } from 'radix-ui'
import { Info, X } from 'lucide-react'
import type { Evidence } from '@/lib/extractors/types'
import { SourceBadge, sourceInfo } from './source-badge'

function pagePath(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.pathname === '/' ? parsed.hostname : `${parsed.hostname}${parsed.pathname}`
  } catch {
    return url
  }
}

function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/**
 * "Show your work": where a color or font was found, how sure we are, and why.
 */
export function EvidencePopover({
  subject,
  source,
  confidence,
  evidence,
  edited,
}: {
  subject: string
  source: string
  confidence: number
  evidence: Evidence[]
  edited?: boolean
}) {
  const shown = evidence.slice(0, 5)

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          aria-label={`Where ${subject} was found`}
        >
          <Info className="size-4" aria-hidden />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          collisionPadding={16}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-white p-4 text-left shadow-xl"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-900 break-words">{subject}</p>
              <p className="mt-1 text-xs text-slate-600">{sourceInfo(source, edited).description}</p>
            </div>
            <Popover.Close className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Close">
              <X className="size-4" aria-hidden />
            </Popover.Close>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <SourceBadge source={source} edited={edited} />
            <span className="text-xs text-slate-600">{Math.round(confidence)}% confidence</span>
          </div>

          {shown.length > 0 ? (
            <ul className="space-y-2">
              {shown.map((item, index) => {
                const href = safeHref(item.url)
                return (
                  <li key={index} className="rounded-lg bg-slate-50 p-2">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs font-medium text-indigo-700 underline-offset-2 hover:underline">
                        {pagePath(item.url)}
                      </a>
                    ) : (
                      <p className="truncate text-xs font-medium text-slate-700">{item.url}</p>
                    )}
                    <code className="mt-1 block max-h-20 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-800">{item.snippet}</code>
                    {item.context && <p className="mt-1 text-xs text-slate-600">{item.context}</p>}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-xs text-slate-600">No page-level evidence was recorded for this value.</p>
          )}
          {evidence.length > shown.length && (
            <p className="mt-2 text-xs text-slate-600">and {evidence.length - shown.length} more occurrences</p>
          )}
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
