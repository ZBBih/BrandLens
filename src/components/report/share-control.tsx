'use client'

import { useState } from 'react'
import { Popover, Switch } from 'radix-ui'
import { Share2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CopyButton } from './copy-button'

/**
 * Owner-only control that turns the public share link on or off
 */
export function ShareControl({
  reportId,
  isPublic,
  sharePath,
  onChange,
}: {
  reportId: string
  isPublic: boolean
  sharePath?: string
  onChange: (isPublic: boolean, sharePath: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const shareUrl = sharePath && typeof window !== 'undefined' ? new URL(sharePath, window.location.origin).href : sharePath

  const toggle = async (next: boolean) => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/report/${encodeURIComponent(reportId)}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: next }),
      })
      const data = response.headers.get('content-type')?.includes('application/json') ? await response.json() : {}
      if (!response.ok) {
        setError(data.error ?? 'Sharing could not be updated. Please try again.')
        return
      }
      onChange(data.isPublic, data.sharePath)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm">
          <Share2 aria-hidden />
          Share
          {isPublic && <span className="rounded-full bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-800">On</span>}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} collisionPadding={16} className="z-50 w-[min(24rem,calc(100vw-2rem))] rounded-xl border bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Share this report</h2>
              <p className="mt-1 text-sm text-slate-700">Anyone with the link can view the report, including your edits. They can&apos;t change it.</p>
            </div>
            <Popover.Close className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100" aria-label="Close">
              <X className="size-4" aria-hidden />
            </Popover.Close>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <label htmlFor="share-switch" className="text-sm font-medium text-slate-900">
              Public link
            </label>
            <Switch.Root
              id="share-switch"
              checked={isPublic}
              disabled={saving}
              onCheckedChange={toggle}
              className="relative h-6 w-11 shrink-0 rounded-full bg-slate-400 transition-colors data-[state=checked]:bg-indigo-600 disabled:opacity-60"
            >
              <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
            </Switch.Root>
          </div>

          <p role="status" className="sr-only">
            {saving ? 'Updating sharing…' : isPublic ? 'Public link is on' : 'Public link is off'}
          </p>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {error}
            </p>
          )}

          {isPublic && shareUrl && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium text-slate-700">Link</p>
              <div className="flex items-center gap-2 rounded-lg border p-2">
                <a href={shareUrl} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate text-sm text-indigo-700 hover:underline">
                  {shareUrl}
                </a>
                <CopyButton text={shareUrl} label="share link" />
              </div>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
