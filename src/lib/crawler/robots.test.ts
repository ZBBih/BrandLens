import { beforeEach, describe, expect, it, vi } from 'vitest'

const bodies: Record<string, string> = {}

vi.mock('../net/safe-fetch', () => ({
  USER_AGENT: 'BrandLens/test',
  safeFetch: vi.fn(async (url: string) => {
    const body = bodies[url]
    return {
      url,
      status: body === undefined ? 404 : 200,
      headers: {},
      body: Buffer.from(body ?? ''),
      truncated: false,
      text: () => body ?? '',
    }
  }),
}))

const { canCrawl, getSitemaps, parseRobotsTxt, isAllowed, matchesPattern, clearRobotsCache } = await import('./robots')

beforeEach(() => clearRobotsCache())

describe('robots.txt groups (A10)', () => {
  it('ignores a GPTBot group that precedes the * group', async () => {
    bodies['https://d.com/robots.txt'] = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n'
    expect((await canCrawl('https://d.com/')).allowed).toBe(true)
    expect((await canCrawl('https://d.com/about')).allowed).toBe(true)
    expect((await canCrawl('https://d.com/admin/x')).allowed).toBe(false)
  })

  it('ignores a GPTBot group that follows the * group', async () => {
    bodies['https://a.com/robots.txt'] = 'User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n'
    expect((await canCrawl('https://a.com/')).allowed).toBe(true)
  })

  it('applies rules of a multi-agent group (* + Slurp)', async () => {
    bodies['https://b.com/robots.txt'] = 'User-agent: *\nUser-agent: Slurp\nDisallow: /private\n'
    expect((await canCrawl('https://b.com/private/x')).allowed).toBe(false)
    expect((await canCrawl('https://b.com/public')).allowed).toBe(true)
  })

  it('prefers a brandlens group over *', () => {
    const data = parseRobotsTxt(
      'User-agent: *\nDisallow: /\n\nUser-agent: BrandLens/1.0\nDisallow: /secret\n',
      'https://x.com/robots.txt'
    )
    expect(isAllowed('/', data.rules)).toBe(true)
    expect(isAllowed('/secret', data.rules)).toBe(false)
  })

  it('never lets "…bot" agents apply to us', () => {
    const data = parseRobotsTxt('User-agent: Googlebot\nDisallow: /\nUser-agent: CCBot\nDisallow: /\n', 'https://x.com/robots.txt')
    expect(data.rules).toEqual([])
  })

  it('handles comments, CRLF and case', () => {
    const data = parseRobotsTxt('# hi\r\nUSER-AGENT: * # all\r\nDISALLOW: /tmp # temp\r\n', 'https://x.com/robots.txt')
    expect(isAllowed('/tmp/a', data.rules)).toBe(false)
  })
})

describe('rule matching', () => {
  it('longest match wins and Allow wins ties', () => {
    const rules = [
      { path: '/folder', allow: false },
      { path: '/folder/page', allow: true },
      { path: '/tie', allow: false },
      { path: '/tie', allow: true },
    ]
    expect(isAllowed('/folder/x', rules)).toBe(false)
    expect(isAllowed('/folder/page', rules)).toBe(true)
    expect(isAllowed('/tie', rules)).toBe(true)
  })

  it('supports * and $', () => {
    expect(matchesPattern('/*.pdf$', '/docs/a.pdf')).toBe(true)
    expect(matchesPattern('/*.pdf$', '/docs/a.pdf?x=1')).toBe(false)
    expect(matchesPattern('/a*b', '/a/x/b/c')).toBe(true)
    expect(matchesPattern('/a*b', '/a/x/c')).toBe(false)
    expect(matchesPattern('/', '/anything')).toBe(true)
    expect(matchesPattern('/exact$', '/exact')).toBe(true)
    expect(matchesPattern('/exact$', '/exactly')).toBe(false)
  })

  it('matches hostile patterns in linear-ish time', () => {
    const start = Date.now()
    matchesPattern('/' + '*a'.repeat(200) + 'b', '/' + 'a'.repeat(2000))
    expect(Date.now() - start).toBeLessThan(250)
  })
})

describe('crawl-delay and sitemaps (A9, A24)', () => {
  it('clamps Crawl-delay 86400 to 10 and rejects a metadata sitemap', async () => {
    bodies['https://c.com/robots.txt'] = 'User-agent: *\nCrawl-delay: 86400\nSitemap: http://169.254.169.254/latest/meta-data/\n'
    expect(await canCrawl('https://c.com/')).toEqual({ allowed: true, crawlDelay: 10 })
    expect(await getSitemaps('https://c.com')).toEqual([])
  })

  it('keeps same-site sitemaps (including www) and drops other hosts', () => {
    const data = parseRobotsTxt(
      'Sitemap: https://www.e.com/sitemap.xml\nSitemap: https://evil.com/s.xml\nSitemap: ftp://e.com/s.xml\nSitemap: /rel.xml\n',
      'https://e.com/robots.txt'
    )
    expect(data.sitemaps).toEqual(['https://www.e.com/sitemap.xml', 'https://e.com/rel.xml'])
  })

  it('treats a missing robots.txt as allow-all', async () => {
    expect(await canCrawl('https://none.com/anything')).toEqual({ allowed: true, crawlDelay: undefined })
  })
})
