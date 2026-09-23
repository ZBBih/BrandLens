import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CompareScreen } from './compare-screen'

export const metadata: Metadata = {
  title: 'Compare brands',
  robots: { index: false, follow: false },
}

export default function ComparePage() {
  return (
    <Suspense fallback={<main id="main-content" className="min-h-screen bg-slate-50" />}>
      <CompareScreen />
    </Suspense>
  )
}
