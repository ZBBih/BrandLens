import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const generateText = vi.hoisted(() => vi.fn())
vi.mock('ai', async importOriginal => ({ ...(await importOriginal<typeof import('ai')>()), generateText }))

const { APICallError, RetryError } = await import('ai')
const { generateStructured } = await import('./llm')

const request = { schema: z.object({ ok: z.boolean() }), system: 's', prompt: 'p', effort: 'low' as const }

function apiError(statusCode: number) {
  const lastError = new APICallError({ message: `HTTP ${statusCode}`, url: 'https://example.test', requestBodyValues: {}, statusCode })
  return new RetryError({ message: 'Failed after 2 attempts', reason: 'maxRetriesExceeded', errors: [lastError] })
}

const modelsCalled = () => generateText.mock.calls.map(([options]) => options.model.modelId)

describe('generateStructured with Gemini', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    generateText.mockReset()
  })
  afterEach(() => vi.unstubAllEnvs())

  it('moves to the fallback model when the primary is overloaded', async () => {
    generateText.mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce({ output: { ok: true }, finishReason: 'stop' })

    await expect(generateStructured(request)).resolves.toEqual({ ok: true })
    expect(modelsCalled()).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash'])
  })

  it('does not retry other errors on another model', async () => {
    generateText.mockRejectedValueOnce(apiError(400))

    await expect(generateStructured(request)).rejects.toThrow(RetryError)
    expect(generateText).toHaveBeenCalledTimes(1)
  })

  it('rejects truncated output', async () => {
    generateText.mockResolvedValueOnce({ output: { ok: true }, finishReason: 'length' })

    await expect(generateStructured(request)).rejects.toThrow(/truncated/)
  })
})
