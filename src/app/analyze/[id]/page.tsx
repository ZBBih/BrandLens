import type { Metadata } from 'next'
import { AnalysisScreen } from './analysis-screen'

export const metadata: Metadata = {
  title: 'Brand report',
  // Private working reports are reachable by link only; keep them out of search
  robots: { index: false, follow: false },
}

export default async function AnalyzePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AnalysisScreen key={id} id={id} />
}
