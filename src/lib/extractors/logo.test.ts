import { describe, it, expect } from 'vitest'
import { extractLogo, resolveLogoUrl } from './logo'
import { makePage } from './__fixtures__/pages'

describe('resolveLogoUrl', () => {
  const page = 'https://www.acme.com/about/'

  it('resolves relative paths against the crawled page', () => {
    expect(resolveLogoUrl('/assets/logo.svg', page)).toBe('https://www.acme.com/assets/logo.svg')
    expect(resolveLogoUrl('img/logo.png', page)).toBe('https://www.acme.com/about/img/logo.png')
    expect(resolveLogoUrl('//cdn.other.net/logo.png', page)).toBe('https://cdn.other.net/logo.png')
  })

  it('upgrades http only for the same site', () => {
    expect(resolveLogoUrl('http://acme.com/logo.png', page)).toBe('https://acme.com/logo.png')
    expect(resolveLogoUrl('http://static.acme.com/logo.png', page)).toBe('https://static.acme.com/logo.png')
    expect(resolveLogoUrl('http://tracker.evil.test/logo.png', page)).toBeUndefined()
  })

  it('rejects dangerous or non-https schemes', () => {
    expect(resolveLogoUrl('javascript:alert(1)//logo', page)).toBeUndefined()
    expect(resolveLogoUrl(' JaVaScRiPt:alert(1)', page)).toBeUndefined()
    expect(resolveLogoUrl('data:image/svg+xml,<svg/>', page)).toBeUndefined()
    expect(resolveLogoUrl('file:///etc/passwd', page)).toBeUndefined()
    expect(resolveLogoUrl('https://user:pw@acme.com/logo.png', page)).toBeUndefined()
  })
})

describe('extractLogo', () => {
  it('resolves a header logo to the crawled site, not BrandLens', () => {
    const page = makePage({
      url: 'https://acme.com/',
      html: '<html><head></head><body><header><a class="logo" href="/"><img src="/assets/logo.svg"></a></header></body></html>',
    })
    expect(extractLogo([page]).logoUrl).toBe('https://acme.com/assets/logo.svg')
  })

  it('rejects a javascript: og:image and falls through', () => {
    const page = makePage({
      url: 'https://acme.com/',
      ogData: { image: 'javascript:alert(1)//logo' },
      html: '<html><head><meta property="og:image" content="javascript:alert(1)//logo"></head><body></body></html>',
    })
    const result = extractLogo([page])
    expect(result.logoUrl).toBeUndefined()
    expect(JSON.stringify(result)).not.toContain('javascript:')
  })

  it('prefers the logo meta tag and resolves favicons', () => {
    const withMeta = makePage({
      url: 'https://acme.com/x/',
      html: '<html><head><meta name="logo" content="../brand/logo.png"></head><body></body></html>',
    })
    expect(extractLogo([withMeta]).logoUrl).toBe('https://acme.com/brand/logo.png')

    const withFavicon = makePage({
      url: 'https://acme.com/',
      html: '<html><head><link rel="icon" href="/favicon-16.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple.png"></head><body></body></html>',
    })
    const result = extractLogo([withFavicon])
    expect(result.logoUrl).toBeUndefined()
    expect(result.faviconUrl).toBe('https://acme.com/apple.png')
  })

  it('handles hostile markup in linear time', () => {
    const html = `<html><body>${'<b class="logo">'.repeat(8000)}${'<img src=x '.repeat(4000)}</body></html>`
    expect(html.length).toBeGreaterThan(170_000)
    const page = makePage({ url: 'https://acme.com/', html })
    const start = performance.now()
    extractLogo([page])
    expect(performance.now() - start).toBeLessThan(250)
  })
})
