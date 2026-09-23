'use client'

import { Check, Copy } from 'lucide-react'
import { useCopy } from '@/lib/client/use-copy'
import { cn } from '@/lib/utils'

/**
 * Small copy control whose result is shown and announced to screen readers
 */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const { status, copy } = useCopy()

  return (
    <button
      type="button"
      onClick={() => copy(text)}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        className
      )}
    >
      {status === 'copied' ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span>{status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Copy'}</span>
      <span className="sr-only"> {label}</span>
      <span role="status" className="sr-only">
        {status === 'copied' ? `${label} copied to clipboard` : status === 'failed' ? `Could not copy ${label}` : ''}
      </span>
    </button>
  )
}
