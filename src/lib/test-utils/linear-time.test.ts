import { describe, expect, it } from 'vitest'
import { expectLinearTime } from './linear-time'

/** Burn CPU proportional to `units` (resistant to dead-code elimination) */
function work(units: number): number {
  let x = 0
  for (let i = 0; i < units; i++) x = (x + i * 31) % 1_000_003
  return x
}

describe('expectLinearTime', () => {
  it('accepts linear work', () => {
    expectLinearTime(n => n, n => work(n * 20_000), 200)
  }, 30_000)

  it('rejects quadratic work, so the hostile-input tests still catch ReDoS', () => {
    expect(() => expectLinearTime(n => n, n => work(n * n * 40), 400)).toThrow(/grew/)
  }, 60_000)
})
