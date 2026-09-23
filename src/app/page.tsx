import Link from 'next/link'
import { FileDown, Globe, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLensWordmark } from '@/components/brand-lens-logo'
import { AnalyzeForm } from './analyze-form'

function SwooshIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false">
      <path d="M21 8.719L7.836 14.303C6.74 14.768 5.818 15 5.075 15c-.836 0-1.445-.295-1.819-.884-.485-.76-.273-1.982.559-3.272.494-.754 1.122-1.446 1.734-2.108-.144.234-1.415 2.349-.025 3.345.275.197.63.293 1.055.293.775 0 1.723-.376 2.825-.837L21 8.719z" />
    </svg>
  )
}

const STEPS = [
  { Icon: Globe, title: 'Enter a URL', text: 'Paste any public website address.' },
  { Icon: ScanSearch, title: 'We analyse it', text: 'We read the site to find its colours, fonts and logo, and AI describes its voice.' },
  { Icon: FileDown, title: 'Use the results', text: 'Correct anything we got wrong, then export a PDF, design tokens or code.' },
]

const FEATURES = ['Typography', 'Colours', 'Tone & voice', 'SEO', 'Social links', 'PDF & design tokens']

export default function Home() {
  return (
    <main id="main-content" className="animated-gradient-bg flex min-h-screen flex-col items-center px-4 pb-20 pt-16 md:pt-28">
      <div className="w-full max-w-xl">
        <div className="animate-fade-in-up mb-10 text-center">
          <BrandLensWordmark as="h1" size="lg" />
          <p className="mt-3 text-lg text-slate-700">Brand guidelines from any website, in about two minutes</p>
        </div>

        <section aria-labelledby="analyze-heading" className="card-enhanced animate-fade-in-up-delay-1 rounded-xl border bg-white p-6 shadow-lg">
          <h2 id="analyze-heading" className="text-lg font-semibold text-slate-900">
            Analyze a brand
          </h2>
          <p className="mb-5 mt-1 text-sm text-slate-700">
            Enter a company&apos;s website to extract its colours, typography, logo and tone of voice.
          </p>
          <AnalyzeForm />
        </section>

        <p className="animate-fade-in-up-delay-2 mt-4 text-center text-sm text-slate-700">Free, no sign-up. Every value shows where it was found.</p>

        <div className="animate-fade-in-up-delay-2 mt-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3" aria-hidden>
            <span className="h-px w-12 bg-slate-300" />
            <span className="text-sm text-slate-700">or</span>
            <span className="h-px w-12 bg-slate-300" />
          </div>
          <Button asChild variant="outline" className="btn-hover-lift h-auto gap-2 px-6 py-3 text-base">
            <Link href="/demo">
              <SwooshIcon className="size-5" />
              See a sample report for Nike
            </Link>
          </Button>
          <p className="mt-3 text-sm text-slate-700">Opens instantly, no analysis needed</p>
        </div>

        <section aria-labelledby="how-heading" className="animate-fade-in-up-delay-3 mt-20">
          <h2 id="how-heading" className="mb-10 text-center text-2xl font-semibold text-slate-900">
            How it works
          </h2>
          <ol className="flex flex-col items-center justify-between gap-8 md:flex-row md:items-start md:gap-4">
            {STEPS.map(({ Icon, title, text }) => (
              <li key={title} className="flex flex-1 flex-col items-center text-center">
                <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-indigo-50" aria-hidden>
                  <Icon className="size-8 text-indigo-600" />
                </span>
                <h3 className="mb-2 font-semibold text-slate-900">{title}</h3>
                <p className="max-w-[200px] text-sm text-slate-700">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features-heading" className="mt-20 text-center">
          <h2 id="features-heading" className="mb-6 text-sm font-medium text-slate-700">
            What&apos;s in a report
          </h2>
          <ul className="flex flex-wrap justify-center gap-3">
            {FEATURES.map((feature, i) => (
              <li key={feature} className={`animate-stagger-${i + 1} rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-sm text-slate-800`}>
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-20 text-center text-sm text-slate-700">
          <Link href="/privacy" className="underline underline-offset-4 hover:text-slate-900">
            Privacy &amp; data
          </Link>
        </footer>
      </div>
    </main>
  )
}
