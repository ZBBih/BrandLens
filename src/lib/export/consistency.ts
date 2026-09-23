/**
 * Consistency-score shape helpers shared by the scorer, the exports and the
 * PDF. Dependency-free (types only) so client components can import it.
 */

import type {
  ConsistencyBreakdown,
  ConsistencyData,
  ConsistencyDimension,
  ConsistencyGrade,
  DimensionScore,
} from '../extractors/types'

/** Maximum points per dimension */
export const CONSISTENCY_MAX: Record<ConsistencyDimension, number> = {
  color: 25,
  typography: 20,
  tone: 25,
  seo: 15,
  message: 15,
}

export const CONSISTENCY_DIMENSIONS: ConsistencyDimension[] = ['color', 'typography', 'tone', 'seo', 'message']

export const CONSISTENCY_LABELS: Record<ConsistencyDimension, string> = {
  color: 'Color',
  typography: 'Typography',
  tone: 'Tone',
  seo: 'SEO',
  message: 'Message',
}

/**
 * Normalise consistency data from any report version. Reports stored before
 * the per-dimension shape carried plain numbers in `breakdown`; those are
 * converted to scored dimensions so renderers only handle one shape.
 */
export function normalizeConsistencyData(raw: unknown): ConsistencyData | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const data = raw as Record<string, unknown>
  const rawBreakdown = (data.breakdown ?? {}) as Record<string, unknown>
  const breakdown = {} as ConsistencyBreakdown
  for (const dim of CONSISTENCY_DIMENSIONS) {
    const value = rawBreakdown[dim]
    if (typeof value === 'number') {
      breakdown[dim] = { score: value, max: CONSISTENCY_MAX[dim], status: 'scored' }
    } else if (value && typeof value === 'object' && 'status' in value) {
      breakdown[dim] = value as DimensionScore
    } else {
      breakdown[dim] = { score: null, max: CONSISTENCY_MAX[dim], status: 'insufficient_data', reason: 'not recorded' }
    }
  }
  const grade = typeof data.grade === 'string' && /^[ABCDF]$/.test(data.grade) ? (data.grade as ConsistencyGrade) : null
  return {
    score: typeof data.score === 'number' ? data.score : null,
    grade,
    breakdown,
    issues: Array.isArray(data.issues) ? data.issues.filter((i): i is string => typeof i === 'string') : [],
    insufficientData: Array.isArray(data.insufficientData)
      ? data.insufficientData.filter((i): i is string => typeof i === 'string')
      : [],
    pagesAnalyzed: typeof data.pagesAnalyzed === 'number' ? data.pagesAnalyzed : 0,
  }
}
