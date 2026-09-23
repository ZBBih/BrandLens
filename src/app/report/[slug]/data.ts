import { cache } from 'react'
import { DEMO_REPORT, DEMO_SLUG } from '@/lib/demo/data'
import { getPublicReport } from '@/lib/report/store'

/**
 * One lookup per request, shared by generateMetadata, the page and the OG image
 */
export const loadPublicReport = cache(async (slug: string) => {
  if (slug === DEMO_SLUG) return DEMO_REPORT
  return getPublicReport(slug)
})
