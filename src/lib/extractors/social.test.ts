import { describe, expect, it } from 'vitest'
import type { PageData } from '../crawler'
import { extractSocial } from './social'

function page(url: string, links: string[], twitterSite?: string): PageData {
  const html = `<html><body>${links.map(href => `<a href="${href}">link</a>`).join('')}</body></html>`
  return {
    url,
    html,
    title: '',
    description: '',
    keywords: [],
    ogData: {},
    twitterData: twitterSite ? { site: twitterSite } : {},
    headings: [],
    links: [],
    images: [],
    cssUrls: [],
    inlineCss: [],
    navLabels: [],
    ctaButtons: [],
    footerContent: '',
    schemaData: [],
  }
}

const footer = ['https://www.linkedin.com/company/stripe', 'https://x.com/stripe', 'https://www.youtube.com/@stripe']

describe('extractSocial', () => {
  it("keeps the brand's own account per platform, not accounts linked from case studies", () => {
    const pages = [
      page('https://stripe.com/', footer),
      page('https://stripe.com/about', footer),
      page('https://stripe.com/customers/acme', [
        ...footer,
        'https://www.linkedin.com/in/jane-doe-123',
        'https://uk.linkedin.com/in/john-smith',
        'https://x.com/acmecorp',
        'https://x.com/janedoe',
      ]),
    ]

    const { links } = extractSocial(pages)
    expect(links.map(l => [l.platform, l.url])).toEqual([
      ['linkedin', 'https://www.linkedin.com/company/stripe'],
      ['twitter', 'https://x.com/stripe'],
      ['youtube', 'https://www.youtube.com/@stripe'],
    ])
  })

  it('never treats a personal LinkedIn profile as a brand channel', () => {
    const { links } = extractSocial([page('https://example.com/', ['https://www.linkedin.com/in/someone'])])
    expect(links).toEqual([])
  })

  it('prefers the twitter:site account over a more frequently linked one', () => {
    const pages = [
      page('https://brand.com/', ['https://x.com/partner'], '@brand'),
      page('https://brand.com/a', ['https://x.com/partner']),
    ]
    expect(extractSocial(pages).links.find(l => l.platform === 'twitter')?.handle).toBe('@brand')
  })
})
