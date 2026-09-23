import type { Metadata } from 'next'
import Link from 'next/link'
import { RETENTION } from '@/lib/report/store'

export const metadata: Metadata = {
  title: 'Privacy & data',
  description: 'What BrandLens collects, how long reports are kept, and how site owners can opt out.',
}

const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL

export default function PrivacyPage() {
  return (
    <main id="main-content" className="mx-auto max-w-2xl px-4 py-16 text-slate-800">
      <Link href="/" className="text-sm font-medium text-indigo-700 underline-offset-4 hover:underline">
        ← BrandLens
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-bold text-slate-900">Privacy &amp; data</h1>

      <section aria-labelledby="collect" className="mb-8 space-y-3">
        <h2 id="collect" className="text-xl font-semibold text-slate-900">What we collect</h2>
        <p>
          When you analyze a website, BrandLens visits up to 25 of its public pages and reads what any visitor could see: colors, fonts, headings, meta
          tags, public contact details and links. That content is summarized by Anthropic&apos;s Claude API to describe the brand&apos;s voice.
        </p>
        <p>
          We don&apos;t ask for an account. To enforce the daily free limit we count analyses per IP address; those counters are deleted after a week.
          A cookie on your device lets you edit and share the reports you create; it contains no personal information.
        </p>
      </section>

      <section aria-labelledby="retention" className="mb-8 space-y-3">
        <h2 id="retention" className="text-xl font-semibold text-slate-900">How long reports are kept</h2>
        <p>
          Reports are deleted automatically after {RETENTION.privateDays} days. Reports whose owner turned on a public share link are kept for{' '}
          {RETENTION.publicDays} days. Shared reports are excluded from search engines.
        </p>
      </section>

      <section aria-labelledby="site-owners" className="space-y-3">
        <h2 id="site-owners" className="text-xl font-semibold text-slate-900">For site owners</h2>
        <p>
          BrandLens identifies itself with the user agent <code className="rounded bg-slate-100 px-1">BrandLens/1.0</code> and follows robots.txt. To
          stop it reading your site, add:
        </p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
          {'User-agent: BrandLens\nDisallow: /'}
        </pre>
        {contactEmail ? (
          <p>
            To have an existing report about your site removed, email{' '}
            <a href={`mailto:${contactEmail}`} className="font-medium text-indigo-700 underline">
              {contactEmail}
            </a>
            .
          </p>
        ) : (
          <p>Existing reports about your site expire on their own within {RETENTION.privateDays} days.</p>
        )}
      </section>
    </main>
  )
}
