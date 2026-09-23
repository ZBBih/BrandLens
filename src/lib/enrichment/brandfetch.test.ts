import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  transformBrandfetchData,
  normalizeBrandfetchHex,
  mergeBrandfetchColors,
  mergeBrandfetchData,
  fetchBrandfetchData,
} from './brandfetch'
import type { BrandfetchResponse } from './brandfetch'
import type { ColorEntry } from '../extractors/types'

const response = (overrides: Partial<BrandfetchResponse> = {}): BrandfetchResponse => ({
  name: 'Acme',
  domain: 'acme.test',
  claimed: false,
  description: 'Acme',
  longDescription: null,
  links: [{ name: 'twitter', url: 'https://twitter.com/acme' }, { name: 'instagram', url: 'javascript:alert(1)' }],
  logos: [{ type: 'logo', theme: 'dark', formats: [{ src: 'http://cdn.test/logo.svg', background: null, format: 'svg', size: 1 }, { src: 'https://cdn.test/logo.png', background: null, format: 'png', size: 1 }] }],
  colors: [
    { hex: '#635BFF', type: 'accent', brightness: 100 },
    { hex: '0a2540', type: 'dark', brightness: 20 },
    { hex: '#FFF', type: 'light', brightness: 255 },
    { hex: '#00d4ff', type: 'brand', brightness: 180 },
    { hex: '#ff5996', type: 'brand', brightness: 150 },
    { hex: '#abc123', type: 'vibrant', brightness: 150 },
    { hex: 'not-a-color', type: 'brand', brightness: 0 },
    { hex: '#12345', type: 'accent', brightness: 0 },
  ],
  fonts: [{ name: 'Sohne', type: 'title', origin: null, originId: null, weights: [400, 600] }],
  images: [],
  qualityScore: 0.8,
  ...overrides,
})

const extractedColor = (hex: string, role: ColorEntry['role'], areaShare?: number): ColorEntry => ({
  hex,
  rgb: { r: 0, g: 0, b: 0 },
  role,
  confidence: 80,
  source: 'extracted',
  evidence: [{ url: 'https://acme.test/', snippet: `background-color: ${hex}` }],
  ...(areaShare !== undefined ? { areaShare } : {}),
})

describe('normalizeBrandfetchHex', () => {
  it('validates and expands hex values', () => {
    expect(normalizeBrandfetchHex('#FFF')).toBe('#ffffff')
    expect(normalizeBrandfetchHex('0a2540')).toBe('#0a2540')
    expect(normalizeBrandfetchHex('#12345')).toBeNull()
    expect(normalizeBrandfetchHex('rgb(1,2,3)')).toBeNull()
    expect(normalizeBrandfetchHex(undefined)).toBeNull()
  })
})

describe('transformBrandfetchData', () => {
  it('labels unclaimed data third_party at 70% confidence', () => {
    const data = transformBrandfetchData(response())
    expect(data.verified).toBe(false)
    for (const item of [...data.colors, ...data.fonts, ...data.socialLinks]) {
      expect(item.source).toBe('third_party')
      expect(item.confidence).toBe(70)
    }
  })

  it('labels claimed data verified at 100% confidence', () => {
    const data = transformBrandfetchData(response({ claimed: true }))
    expect(data.verified).toBe(true)
    expect(data.colors.every(c => c.source === 'verified' && c.confidence === 100)).toBe(true)
  })

  it('maps color types 1:1 with at most one primary and never NaN', () => {
    const { colors } = transformBrandfetchData(response())
    const byHex = Object.fromEntries(colors.map(c => [c.hex, c.role]))
    expect(byHex).toEqual({
      '#635bff': 'accent',
      '#0a2540': 'text',
      '#ffffff': 'background',
      '#00d4ff': 'primary',
      '#ff5996': 'secondary',
      '#abc123': 'other',
    })
    expect(colors.filter(c => c.role === 'primary')).toHaveLength(1)
    for (const c of colors) {
      expect(Number.isNaN(c.rgb.r) || Number.isNaN(c.rgb.g) || Number.isNaN(c.rgb.b)).toBe(false)
    }
    expect(colors.find(c => c.hex === '#ffffff')?.rgb).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('only emits https logo and social URLs', () => {
    const data = transformBrandfetchData(response())
    expect(data.logoUrl).toBe('https://cdn.test/logo.png')
    expect(data.socialLinks.map(l => l.platform)).toEqual(['twitter'])
    const noLogo = transformBrandfetchData(response({ logos: [{ type: 'logo', theme: 'x', formats: [{ src: 'data:image/png;base64,AA', background: null, format: 'png', size: 1 }] }] }))
    expect(noLogo.logoUrl).toBeNull()
  })
})

describe('mergeBrandfetchColors', () => {
  const bf = (hex: string, role: ColorEntry['role'], source: ColorEntry['source'] = 'third_party'): ColorEntry => ({
    hex, rgb: { r: 0, g: 0, b: 0 }, role, confidence: source === 'verified' ? 100 : 70, source, evidence: [],
  })

  it('keeps the extracted primary when rendered area strongly disagrees with an unclaimed Brandfetch primary', () => {
    const merged = mergeBrandfetchColors(
      [extractedColor('#635bff', 'primary', 0.3), extractedColor('#00d4ff', 'secondary', 0.01)],
      [bf('#e11d48', 'primary')]
    )
    expect(merged[0]).toMatchObject({ hex: '#635bff', role: 'primary' })
    expect(merged.find(c => c.hex === '#e11d48')?.role).not.toBe('primary')
    expect(merged.filter(c => c.role === 'primary')).toHaveLength(1)
  })

  it('lets a claimed Brandfetch primary win', () => {
    const merged = mergeBrandfetchColors(
      [extractedColor('#635bff', 'primary', 0.3)],
      [bf('#e11d48', 'primary', 'verified')]
    )
    expect(merged[0]).toMatchObject({ hex: '#e11d48', role: 'primary', source: 'verified' })
    expect(merged.filter(c => c.role === 'primary')).toHaveLength(1)
  })

  it('lets an unclaimed Brandfetch primary win without strong area evidence', () => {
    const merged = mergeBrandfetchColors(
      [extractedColor('#635bff', 'primary')],
      [bf('#e11d48', 'primary')]
    )
    expect(merged[0]).toMatchObject({ hex: '#e11d48', role: 'primary' })
    expect(merged.find(c => c.hex === '#635bff')?.role).toBe('secondary')
  })

  it('merges near-identical colors and keeps the extracted evidence', () => {
    const merged = mergeBrandfetchColors(
      [extractedColor('#635bfe', 'primary', 0.2)],
      [bf('#635bff', 'primary')]
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({ hex: '#635bff', role: 'primary', areaShare: 0.2 })
    expect(merged[0].evidence.some(e => e.snippet.includes('#635bfe'))).toBe(true)
  })

  it('is used by mergeBrandfetchData for color lists', () => {
    const merged = mergeBrandfetchData(
      [extractedColor('#635bff', 'primary', 0.3)],
      [bf('#e11d48', 'primary')],
      c => c.hex
    )
    expect(merged.filter(c => c.role === 'primary').map(c => c.hex)).toEqual(['#635bff'])
  })
})

describe('fetchBrandfetchData', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('sends an 8s abort signal', async () => {
    vi.stubEnv('BRANDFETCH_API_KEY', 'test-key')
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response()), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    const data = await fetchBrandfetchData('https://www.acme.test/path')
    expect(data?.name).toBe('Acme')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.brandfetch.io/v2/brands/acme.test')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(timeoutSpy).toHaveBeenCalledWith(8000)
    timeoutSpy.mockRestore()
  })
})
