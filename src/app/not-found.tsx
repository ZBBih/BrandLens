import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandLensWordmark } from '@/components/brand-lens-logo'

export default function NotFound() {
  return (
    <main id="main-content" className="animated-gradient-bg flex min-h-screen flex-col items-center justify-center gap-8 p-4 text-center">
      <BrandLensWordmark />
      <div className="max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mb-6 text-slate-700">
          This page doesn&apos;t exist. If you followed a shared report link, the owner may have turned sharing off, or the report may have expired.
        </p>
        <Button asChild className="bg-indigo-600 text-white hover:bg-indigo-700">
          <Link href="/">Analyze a brand</Link>
        </Button>
      </div>
    </main>
  )
}
