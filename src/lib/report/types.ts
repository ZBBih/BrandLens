/**
 * Report-level types shared by the API routes and the UI
 */

import type { BrandReport, ColorEntry } from '../extractors/types'
import type { JobProgress, JobStatus } from '../jobs/analyze'

/** Owner edits layered over the extracted data; the extracted data is never modified */
export interface ReportOverrides {
  brandName?: string
  /** Keyed by the extracted hex (lowercase) */
  colors?: Record<string, { hex?: string; role?: ColorEntry['role']; hidden?: boolean }>
  /** Keyed by the extracted font name */
  fonts?: Record<string, { name?: string; hidden?: boolean }>
  editedAt?: string
}

export interface ReportView {
  id: string
  status: JobStatus
  progress?: JobProgress
  /** Present once extraction finishes (partial) and when completed (full) */
  report?: BrandReport
  error?: string
  isOwner: boolean
  isPublic: boolean
  /** Path of the public page; only returned to the owner or when public */
  sharePath?: string
  /** Only returned to the owner */
  overrides?: ReportOverrides
  regenerationsLeft: number
  /** True when this report reuses a recent analysis of the same site */
  cachedFrom?: string
}
