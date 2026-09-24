/**
 * Load-independent complexity assertions for tests.
 *
 * Absolute millisecond budgets fail whenever the machine is busy (parallel
 * test files, a real Chromium, a loaded CI runner). What hostile-input tests
 * need to prove is that work grows linearly, not catastrophically, so time the
 * same operation at size n and 4n and compare: linear code takes ~4x as long,
 * quadratic ~16x, exponential backtracking far more. Machine load scales both
 * measurements alike, so the ratio stays meaningful.
 */

import { expect } from 'vitest'

const RUNS = 5
/** Below this, timer noise dominates; treat the small run as at least this long */
const NOISE_FLOOR_MS = 20
/** Linear is ~4 and quadratic ~16; 12 leaves room for load noise and still separates them */
const MAX_RATIO = 12
/** Catches outright hangs regardless of ratio */
const HARD_CEILING_MS = 10_000

function time(run: () => void): number {
  const start = performance.now()
  run()
  return performance.now() - start
}

const median = (samples: number[]) => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)]

/**
 * Assert that `run(build(4n))` costs at most MAX_RATIO times `run(build(n))`.
 * Inputs are built outside the timed region. Small and large runs are
 * interleaved so a burst of machine load hits both measurements alike.
 */
export function expectLinearTime<T>(build: (n: number) => T, run: (input: T) => void, n: number): void {
  const small = build(n)
  const large = build(n * 4)
  run(small) // warm up JIT and caches
  run(large)

  const smallSamples: number[] = []
  const largeSamples: number[] = []
  for (let i = 0; i < RUNS; i++) {
    smallSamples.push(time(() => run(small)))
    largeSamples.push(time(() => run(large)))
  }
  const smallMs = Math.max(NOISE_FLOOR_MS, median(smallSamples))
  const largeMs = median(largeSamples)

  expect(largeMs, `4x input took ${largeMs.toFixed(0)}ms`).toBeLessThan(HARD_CEILING_MS)
  expect(largeMs / smallMs, `grew ${(largeMs / smallMs).toFixed(1)}x for 4x input (${smallMs.toFixed(0)}ms -> ${largeMs.toFixed(0)}ms)`).toBeLessThan(MAX_RATIO)
}
