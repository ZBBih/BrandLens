import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ReportView } from '@/components/report/report-view'
import { DEMO_ID, DEMO_REPORT } from '@/lib/demo/data'
import type { ReportView as ReportViewData } from '@/lib/report/types'

export const metadata: Metadata = {
  title: 'Sample report: Nike',
  description: 'A complete BrandLens report for nike.com: palette, typography, voice, SEO and marketing copy.',
}

const demoView: ReportViewData = {
  id: DEMO_ID,
  status: 'completed',
  report: DEMO_REPORT,
  isOwner: false,
  isPublic: true,
  regenerationsLeft: 0,
}

export default function DemoPage() {
  return (
    <ReportView
      view={demoView}
      context="demo"
      banner={
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-indigo-700 px-5 py-4 text-white">
          <p className="text-sm">
            <span className="mr-2 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-indigo-800">Sample</span>
            This is an example report. Run your own to edit values, share it and regenerate the copy.
          </p>
          <Button asChild size="sm" className="bg-white text-indigo-800 hover:bg-indigo-50">
            <Link href="/">Analyze your brand</Link>
          </Button>
        </div>
      }
    />
  )
}
