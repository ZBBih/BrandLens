import { cn } from '@/lib/utils'

const SOURCES: Record<string, { label: string; description: string; className: string }> = {
  verified: {
    label: 'Verified',
    description: 'Confirmed by the brand in Brandfetch',
    className: 'bg-emerald-100 text-emerald-800',
  },
  third_party: {
    label: 'Brandfetch',
    description: 'From Brandfetch; not confirmed by the brand',
    className: 'bg-sky-100 text-sky-800',
  },
  extracted: {
    label: 'Found on site',
    description: "Read directly from the site's code",
    className: 'bg-indigo-100 text-indigo-800',
  },
  inferred: {
    label: 'AI inferred',
    description: 'Interpreted by AI from the site copy',
    className: 'bg-amber-100 text-amber-900',
  },
  edited: {
    label: 'Edited',
    description: 'Corrected by the person who ran this report',
    className: 'bg-violet-100 text-violet-800',
  },
  not_found: {
    label: 'Not found',
    description: 'Could not be determined',
    className: 'bg-slate-100 text-slate-700',
  },
}

export function sourceInfo(source: string, edited?: boolean) {
  return SOURCES[edited ? 'edited' : source] ?? { label: source, description: source, className: 'bg-slate-100 text-slate-700' }
}

/**
 * Where a value came from, in words (never colour alone)
 */
export function SourceBadge({ source, edited, className }: { source: string; edited?: boolean; className?: string }) {
  const info = sourceInfo(source, edited)
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', info.className, className)} title={info.description}>
      {info.label}
    </span>
  )
}
