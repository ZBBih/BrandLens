/**
 * Characterisation tests for extractTypography.
 *
 * These snapshots were recorded against the single-file typography.ts before it
 * was split into typography/{parse,detect,score,index}.ts, so they prove the
 * split is behavior-preserving. Do not update them casually.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { extractTypography } from './typography'
import { makePage, cssMap } from './__fixtures__/pages'
import type { PageData } from '../crawler'
import type { TypographyExtractionResult } from './typographyExtractor'

let logSpy: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
})
afterAll(() => {
  logSpy.mockRestore()
})

describe('extractTypography (characterisation)', () => {
  it('CSS fallback: Google Fonts link plus font-family declarations', () => {
    const page = makePage({
      url: 'https://acme.test/',
      html: '<html><head><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Playfair+Display:wght@700" rel="stylesheet"></head><body></body></html>',
    })
    const css = cssMap({
      'https://acme.test/': [
        'body{font-family:"Inter",sans-serif} h1{font-family:\'Playfair Display\',serif}',
        '.code{font-family: "JetBrains Mono", monospace} .nav{font-family: var(--font-sans)} .x{font-family: Arial, sans-serif}',
        '.brand{font-family: BRAND-DISPLAY, sans-serif} .i{font-family: FontAwesome}',
      ],
    })
    expect(extractTypography([page], css)).toMatchSnapshot()
  })

  it('computed fonts from Playwright with CSS variables and loaded fonts', () => {
    const page = makePage({
      url: 'https://acme.test/',
      computedFonts: {
        h1: { fontFamily: 'var(--display)', fontWeight: '800', fontSize: '48px', lineHeight: '1.1', letterSpacing: '0', element: 'h1' },
        body: { fontFamily: 'Roboto Flex', fontWeight: '400', fontSize: '16px', lineHeight: '1.5', letterSpacing: '0', element: 'body' },
        button: { fontFamily: 'Arial', fontWeight: '600', fontSize: '14px', lineHeight: '1', letterSpacing: '0', element: 'button' },
        nav: { fontFamily: 'Space Grotesk', fontWeight: '500', fontSize: '14px', lineHeight: '1', letterSpacing: '0', element: 'nav' },
      },
      fontSources: [
        { type: 'google', url: 'https://fonts.googleapis.com/css2?family=Roboto+Flex:wght@400;700&family=Space+Grotesk', fonts: ['Roboto Flex', 'Space Grotesk'] },
      ],
    })
    const extras = page as PageData & { loadedFonts: string[]; googleFonts: string[]; cssVariables: Record<string, string> }
    extras.loadedFonts = ['Clash Display', 'Roboto Flex']
    extras.googleFonts = ['Roboto Flex']
    extras.cssVariables = { '--display': '"Clash Display", sans-serif' }
    expect(extractTypography([page], cssMap({}))).toMatchSnapshot()
  })

  it('comprehensive element scan result', () => {
    const extraction: TypographyExtractionResult = {
      primaryBodyFont: 'var(--font-body)',
      primaryHeadingFont: 'Sohne',
      fontWeights: { 'var(--font-body)': new Set(['400', '500']), Sohne: new Set(['600']), 'Sohne Mono': new Set(['400']) },
      confidence: 82,
      availableFonts: [
        { name: 'Source Serif 4', source: 'google', weights: ['400'], url: 'https://fonts.googleapis.com/css2?family=Source+Serif+4' },
        { name: 'Sohne', source: 'fontface' },
        { name: 'Adobe Fonts (Typekit)', source: 'adobe' },
        { name: 'icomoon', source: 'fontface' },
      ],
      flags: { canvasTextPossible: true, textInImagesPossible: false, hasUnresolvedVariables: true },
      cssVariables: { '--font-body': '"Inter Var", system-ui' },
      unresolvedVars: [],
      stats: { totalElementsScanned: 420, headingElementsCount: 30, bodyElementsCount: 390 },
      rawFontCounts: {
        headings: { Sohne: 28, 'Sohne Mono': 1 },
        body: { 'var(--font-body)': 380, 'Sohne Mono': 12, Georgia: 3 },
      },
    }
    const page = makePage({ url: 'https://acme.test/' })
    ;(page as PageData & { typographyExtraction: TypographyExtractionResult }).typographyExtraction = extraction
    expect(extractTypography([page], cssMap({}))).toMatchSnapshot()
  })
})
