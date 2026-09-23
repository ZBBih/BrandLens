'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandLensWordmark } from '@/components/brand-lens-logo'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" className="animated-gradient-bg flex min-h-screen flex-col items-center justify-center gap-8 p-4 text-center">
      <BrandLensWordmark />
      <div role="alert" className="max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mb-6 text-slate-700">This page hit an unexpected error. Trying again usually fixes it.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={reset} className="bg-indigo-600 text-white hover:bg-indigo-700">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
