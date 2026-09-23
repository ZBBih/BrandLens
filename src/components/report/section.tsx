import { cn } from '@/lib/utils'

/**
 * A titled report section with a real heading (A41)
 */
export function Section({
  id,
  title,
  aside,
  children,
  className,
}: {
  id: string
  title: string
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className={cn('rounded-2xl bg-white p-6 sm:p-10', className)}>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 sm:mb-8">
        <h2 id={`${id}-heading`} className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/**
 * Placeholder shown while a section's data is still being generated
 */
export function SectionSkeleton({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-label={`${label} is still being generated`}>
      <div className="space-y-3 motion-safe:animate-pulse" aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="h-4 rounded bg-slate-200" style={{ width: `${90 - i * 15}%` }} />
        ))}
      </div>
      <p className="mt-4 text-sm text-slate-600">{label} will appear here in a moment.</p>
    </div>
  )
}

/**
 * Small uppercase label used above groups inside a section
 */
export function Eyebrow({ children, as: Tag = 'h3', className }: { children: React.ReactNode; as?: 'h3' | 'p'; className?: string }) {
  return <Tag className={cn('mb-4 text-sm font-semibold uppercase tracking-wider text-slate-600', className)}>{children}</Tag>
}
