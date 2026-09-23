import { describe, it, expect } from 'vitest'
import {
  extractColors,
  parseCssColor,
  extractColorsFromValue,
  classifyColorProperty,
  createVarResolver,
  walkCssDeclarations,
  isNeutralColor,
} from './colors'
import { makePage, cssMap } from './__fixtures__/pages'
import type { PageData } from '../crawler'

const URL = 'https://acme.test/'
const colorsFor = (css: string, pages: PageData[] = []) =>
  extractColors(pages, cssMap({ [URL]: [css] })).colors

describe('parseCssColor', () => {
  it.each([
    ['#2563eb', '#2563eb'],
    ['#ABC', '#aabbcc'],
    ['#2563ebff', '#2563eb'],
    ['#abcd', '#aabbcc'],
    ['rgb(37, 99, 235)', '#2563eb'],
    ['rgb(37 99 235)', '#2563eb'],
    ['rgb(37 99 235 / 0.9)', '#2563eb'],
    ['RGBA(37,99,235,1)', '#2563eb'],
    ['hsl(220deg 80% 50%)', '#195ee6'],
    ['hsl(220, 80%, 50%)', '#195ee6'],
    ['hwb(200 10% 20%)', '#1991cc'],
    ['rebeccapurple', '#663399'],
    ['lab(50% 40 59)', '#bf5702'],
    ['oklch(0.62 0.21 259)', parseCssColor('oklch(62% 0.21 259)')],
    ['color(srgb 1 0 0)', '#ff0000'],
  ])('%s -> %s', (input, expected) => {
    expect(parseCssColor(input)).toBe(expected)
  })

  it.each(['rgba(37,99,235,0.4)', 'rgb(37 99 235 / 30%)', '#2563eb40', 'transparent', 'currentColor', 'inherit', 'none', 'solid'])(
    'ignores %s', (input) => {
      expect(parseCssColor(input)).toBeNull()
    }
  )

  it('always outputs lowercase #rrggbb', () => {
    for (const v of ['oklch(0.7 0.3 140)', 'color(display-p3 1 0 0)', 'lch(50% 80 30)', 'oklab(0.6 0.1 -0.1)']) {
      expect(parseCssColor(v)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('extractColorsFromValue', () => {
  it('treats a var() alpha placeholder as opaque (Tailwind v3)', () => {
    expect(extractColorsFromValue('rgb(37 99 235 / var(--tw-bg-opacity))')).toEqual(['#2563eb'])
    expect(extractColorsFromValue('rgba(37, 99, 235, var(--tw-text-opacity))')).toEqual(['#2563eb'])
  })

  it('tokenises shorthands and gradients', () => {
    expect(extractColorsFromValue('#2563eb url(x.png) no-repeat')).toEqual(['#2563eb'])
    expect(extractColorsFromValue('1px solid oklch(0.62 0.21 259)')).toEqual([parseCssColor('oklch(0.62 0.21 259)')])
    expect(extractColorsFromValue('linear-gradient(90deg, #ff0000 0%, rgb(0 0 255) 100%)')).toEqual(['#ff0000', '#0000ff'])
    expect(extractColorsFromValue('url("data:image/svg+xml;fill=%23ff0000")')).toEqual([])
  })

  it('resolves custom properties, including fallbacks', () => {
    const resolve = createVarResolver(new Map([
      ['--brand', 'var(--blue-600)'],
      ['--blue-600', 'oklch(0.546 0.245 262.881)'],
    ]))
    expect(extractColorsFromValue('var(--brand)', resolve)).toEqual([parseCssColor('oklch(0.546 0.245 262.881)')])
    expect(extractColorsFromValue('var(--missing, #e11d48)', resolve)).toEqual(['#e11d48'])
    expect(extractColorsFromValue('var(--missing)', resolve)).toEqual([])
  })

  it('survives self-referencing and exponential custom-property chains quickly', () => {
    const vars = new Map<string, string>([['--loop', 'var(--loop)']])
    for (let i = 0; i < 50; i++) vars.set(`--v${i}`, Array(8).fill(`var(--v${i + 1})`).join(' '))
    const resolve = createVarResolver(vars)
    const start = performance.now()
    expect(extractColorsFromValue('var(--loop)', resolve)).toEqual([])
    extractColorsFromValue('var(--v0)', resolve)
    expect(performance.now() - start).toBeLessThan(250)
  })
})

describe('classifyColorProperty', () => {
  it('only treats `color` as text color', () => {
    expect(classifyColorProperty('color')).toBe('text')
    expect(classifyColorProperty('border-top-color')).toBe('border')
    expect(classifyColorProperty('border-inline-start-color')).toBe('border')
    expect(classifyColorProperty('border')).toBe('border')
    expect(classifyColorProperty('outline-color')).toBe('outline')
    expect(classifyColorProperty('caret-color')).toBe('caret')
    expect(classifyColorProperty('fill')).toBe('fill')
    expect(classifyColorProperty('stroke')).toBe('stroke')
    expect(classifyColorProperty('background')).toBe('background')
    expect(classifyColorProperty('--brand')).toBe('definition')
    expect(classifyColorProperty('transition')).toBeNull()
  })
})

describe('walkCssDeclarations', () => {
  it('handles nested at-rules, comments and semicolons inside url()', () => {
    const seen: string[] = []
    walkCssDeclarations(
      '/* x{color:red} */ @media (min-width: 1px){ .a{ background: url(data:image/png;base64,AAA) #123456; } } .b{color:#654321}',
      d => seen.push(`${d.selector}|${d.property}|${d.value}`)
    )
    expect(seen).toEqual([
      '.a|background|url(data:image/png;base64,AAA) #123456',
      '.b|color|#654321',
    ])
  })
})

describe('extractColors', () => {
  it('Tailwind v3 space syntax with opacity variable', () => {
    const colors = colorsFor(
      '.bg-blue-600{--tw-bg-opacity:1;background-color:rgb(37 99 235 / var(--tw-bg-opacity))} header a{color:rgb(220 38 38)}'
    )
    expect(colors.map(c => c.hex)).toContain('#2563eb')
    expect(colors.map(c => c.hex)).toContain('#dc2626')
  })

  it('Tailwind v4 oklch theme variables', () => {
    const brand = parseCssColor('oklch(0.62 0.21 259)')!
    const colors = colorsFor(':root{--color-brand:oklch(0.62 0.21 259)} .btn{background-color:var(--color-brand)} .btn:hover{background-color:var(--color-brand)}')
    expect(colors[0].hex).toBe(brand)
    expect(colors[0].role).toBe('primary')
    expect(colors[0].cssVariable).toBe('--color-brand')
  })

  it('legacy comma syntax and shorthand', () => {
    expect(colorsFor('.btn-primary{background-color:rgb(37,99,235)}')[0].hex).toBe('#2563eb')
    expect(colorsFor('.btn-primary{background:#2563eb url(x.png) no-repeat}')[0].hex).toBe('#2563eb')
  })

  it('does not classify border, outline or caret colors as text', () => {
    const colors = colorsFor(
      '.card{border-top-color:#e11d48} input{caret-color:#e11d48; outline-color:#e11d48} p{color:#374151}'
    )
    const rose = colors.find(c => c.hex === '#e11d48')!
    expect(rose.role).not.toBe('text')
    const grey = colors.find(c => c.hex === '#374151')!
    expect(grey.role).toBe('text')
  })

  it('ranks by rendered area: a dominant hero color beats a frequently-mentioned utility color', () => {
    const utilityRules = Array.from({ length: 30 }, (_, i) => `.u-${i}, .nav a.x${i}{color:#dc2626}`).join(' ')
    const css = `${utilityRules} .hero{background-color:#635bff} body{background:#fff;color:#111}`
    const page = makePage({ url: URL }) as PageData & { colorAreas: Record<string, number> }
    page.colorAreas = { '#ffffff': 900000, '#635bff': 400000, '#dc2626': 3000, '#111111': 60000 }

    // Without area data, CSS frequency wins
    expect(colorsFor(css)[0].hex).toBe('#dc2626')

    const colors = colorsFor(css, [page])
    expect(colors[0].hex).toBe('#635bff')
    expect(colors[0].role).toBe('primary')
    expect(colors[0].areaShare).toBeGreaterThan(0.2)
    expect(colors.find(c => c.hex === '#dc2626')?.role).not.toBe('primary')
    expect(colors.find(c => c.hex === '#ffffff')?.role).toBe('background')
    expect(colors.find(c => c.hex === '#111111')?.role).toBe('text')
    expect(colors.filter(c => c.role === 'primary')).toHaveLength(1)
    expect(colors[0].evidence[0].snippet).toMatch(/rendered area/)
  })

  it('never lets neutrals become primary', () => {
    const colors = colorsFor('body{color:#111827;background:#f9fafb} .x{color:#6b7280} .y{border-color:#e5e7eb}')
    expect(colors.some(c => c.role === 'primary')).toBe(false)
    expect(colors.every(c => isNeutralColor(c.hex))).toBe(true)
  })

  it('merges near-identical colors and keeps the most-used as representative', () => {
    const colors = colorsFor('.a{color:#2564ec} .b{background:#2563eb} .c{background:#2563eb} .d{fill:#2563eb}')
    const blues = colors.filter(c => !isNeutralColor(c.hex))
    expect(blues).toHaveLength(1)
    expect(blues[0].hex).toBe('#2563eb')
  })

  it('caps evidence at 5 per color with property: value snippets and selector context', () => {
    const css = Array.from({ length: 12 }, (_, i) => `.btn-${i}{background-color:#635bff}`).join(' ')
    const [primary] = colorsFor(css)
    expect(primary.evidence.length).toBeLessThanOrEqual(5)
    expect(primary.evidence[0]).toMatchObject({ url: URL, snippet: 'background-color: #635bff', context: '.btn-0' })
  })

  it('derives confidence from signal strength', () => {
    const colors = colorsFor(
      Array.from({ length: 20 }, (_, i) => `.a${i}{background:#635bff}`).join(' ') + ' .rare{color:#16a34a}'
    )
    const strong = colors.find(c => c.hex === '#635bff')!
    const weak = colors.find(c => c.hex === '#16a34a')!
    expect(strong.confidence).toBeGreaterThan(weak.confidence)
  })

  it('counts inline style colors', () => {
    const page = makePage({ url: URL, html: '<div style="background-color: rgb(99 91 255)">x</div>' })
    expect(extractColors([page], new Map()).colors[0].hex).toBe('#635bff')
  })

  it('returns an empty palette for no input', () => {
    expect(extractColors([], new Map()).colors).toEqual([])
  })

  it('handles a large stylesheet quickly', () => {
    const css = Array.from({ length: 20000 }, (_, i) => `.c${i}{color:rgb(${i % 255} 99 235 / var(--o));border:1px solid #${(i % 4096).toString(16).padStart(3, '0')}}`).join('\n')
    const start = performance.now()
    colorsFor(css)
    expect(performance.now() - start).toBeLessThan(3000)
  })
})
