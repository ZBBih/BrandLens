import { useId } from 'react'

/**
 * BrandLens mark. Decorative: pair it with visible text.
 */
export function BrandLensIcon({ className = 'w-8 h-8' }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="10" stroke={`url(#${gradientId})`} strokeWidth="2.5" fill="none" />
      <circle cx="14" cy="14" r="6" stroke={`url(#${gradientId})`} strokeWidth="1.5" fill="none" opacity="0.6" />
      <line x1="21.5" y1="21.5" x2="28" y2="28" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2" fill={`url(#${gradientId})`} opacity="0.4" />
    </svg>
  )
}

/**
 * Logo plus wordmark, used as the page title area on standalone screens
 */
export function BrandLensWordmark({ as: Tag = 'p', size = 'md' }: { as?: 'h1' | 'p'; size?: 'md' | 'lg' }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <BrandLensIcon className={size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'} />
      <Tag className={`${size === 'lg' ? 'text-4xl md:text-5xl' : 'text-3xl'} font-bold text-slate-900`}>BrandLens</Tag>
    </div>
  )
}
