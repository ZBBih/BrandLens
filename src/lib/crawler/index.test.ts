import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageData } from './cheerio'

/**
 * Orchestrator tests: the network layers (cheerio fetch, Playwright, robots,
 * sitemap fetch) are mocked so we can test origin handling (A28), the worker
 * pool, site-wide spacing, the deadline (A9) and browser cleanup (A26).
 */

const state = {
  pageImpl: (async (url: string) => makePage(url, [])) as (url: string, signal?: AbortSignal) => Promise<PageData | null>,
  robots: { allowed: true, crawlDelay: undefined as number | undefined },
  sitemaps: [] as string[],
  sitemapBody: '',
  starts: [] as number[],
  active: 0,
  maxActive: 0,
  closeCalls: 0,
}

function makePage(url: string, links: string[]): PageData {
  return {
    url, html: '<html></html>', title: '', description: '', keywords: [], ogData: {}, twitterData: {},
    headings: [], links, images: [], cssUrls: [], inlineCss: [], navLabels: [], ctaButtons: [],
    footerContent: '', schemaData: [],
  }
}

vi.mock('./cheerio', () => ({
  createCssCache: () => new Map(),
  fetchPageCss: async (p: PageData) => [...p.inlineCss],
  crawlPage: async (url: string, signal?: AbortSignal) => {
    state.starts.push(Date.now())
    state.active++
    state.maxActive = Math.max(state.maxActive, state.active)
    try {
      return await state.pageImpl(url, signal)
    } finally {
      state.active--
    }
  },
}))

vi.mock('./playwright', () => ({
  openBrowser: async () => ({
    browser: {},
    close: async () => { state.closeCalls++ },
  }),
  // Pretend rendering failed so the orchestrator falls back to crawlPage.
  crawlPageWithPlaywright: async () => null,
}))

vi.mock('./robots', () => ({
  canCrawl: async () => state.robots,
  getSitemaps: async () => state.sitemaps,
}))

vi.mock('../net/safe-fetch', () => ({
  safeFetch: async (url: string) => ({
    url, status: 200, headers: {}, body: Buffer.from(state.sitemapBody), truncated: false,
    text: () => state.sitemapBody,
  }),
}))

const { crawl, StartSpacer } = await import('./index')

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(signal.reason) }, { once: true })
  })
}

beforeEach(() => {
  state.pageImpl = async (url) => makePage(url, [])
  state.robots = { allowed: true, crawlDelay: undefined }
  state.sitemaps = []
  state.sitemapBody = ''
  state.starts = []
  state.active = 0
  state.maxActive = 0
  state.closeCalls = 0
})

describe('crawl', () => {
  it('uses the final URL after an apex→www redirect as the crawl origin (A28)', async () => {
    state.sitemaps = ['https://www.acme.com/sitemap.xml']
    state.sitemapBody = '<urlset><url><loc>https://www.acme.com/products</loc></url><url><loc>http://169.254.169.254/x</loc></url></urlset>'
    state.pageImpl = async (url) => {
      if (url === 'https://acme.com/') {
        return makePage('https://www.acme.com/', ['https://www.acme.com/team'])
      }
      if (url.startsWith('https://www.acme.com/')) return makePage(url, [])
      return null
    }
    const result = await crawl('acme.com', undefined, { deadlineMs: 10_000, minGapMs: 0 })
    expect(result.finalUrl).toBe('https://www.acme.com/')
    const urls = result.pages.map(p => p.url)
    expect(urls).toContain('https://www.acme.com/')
    expect(urls).toContain('https://www.acme.com/team')
    expect(urls).toContain('https://www.acme.com/products')
    expect(urls).toContain('https://www.acme.com/about')
    expect(urls.every(u => u.startsWith('https://www.acme.com/'))).toBe(true)
    expect(result.cssContents.has('https://www.acme.com/')).toBe(true)
  })

  it('keeps MAX_PAGES and runs at most 3 fetches at once', async () => {
    state.pageImpl = async (url, signal) => {
      await delay(30, signal)
      const n = Math.floor(Math.random() * 1e9)
      return makePage(url, [`https://site.com/p${n}`, `https://site.com/q${n}`])
    }
    const result = await crawl('https://site.com', undefined, { deadlineMs: 20_000, minGapMs: 0 })
    expect(result.pages.length).toBe(25)
    expect(state.maxActive).toBeLessThanOrEqual(3)
    expect(state.maxActive).toBeGreaterThan(1)
    expect(state.closeCalls).toBe(1)
  })

  it('spaces request starts site-wide by Crawl-delay across workers', async () => {
    state.robots = { allowed: true, crawlDelay: 0.15 }
    state.pageImpl = async (url) => (url.endsWith('/') ? makePage(url, []) : null)
    const result = await crawl('https://slow.com', undefined, { deadlineMs: 1_500, minGapMs: 0 })
    expect(state.starts.length).toBeGreaterThan(3)
    const sorted = [...state.starts].sort((a, b) => a - b)
    // Slots are 150 ms apart; allow a little scheduling jitter per start
    // but require the overall rate to match the delay (3 workers, not 3x).
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(100)
    }
    expect(sorted[sorted.length - 1] - sorted[0]).toBeGreaterThanOrEqual(150 * (sorted.length - 1) - 40)
    expect(result.errors).toContain('Total crawl timeout exceeded')
  })

  it('returns partial results at the deadline even with a 10 s Crawl-delay (A9)', async () => {
    state.robots = { allowed: true, crawlDelay: 10 }
    const started = Date.now()
    const result = await crawl('https://hang.com', undefined, { deadlineMs: 400 })
    expect(Date.now() - started).toBeLessThan(1_500)
    expect(result.pages.length).toBe(1)
    expect(result.errors).toContain('Total crawl timeout exceeded')
    expect(state.closeCalls).toBe(1)
  })

  it('aborts in-flight fetches at the deadline', async () => {
    state.pageImpl = (_url, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
    const started = Date.now()
    const result = await crawl('https://never.com', undefined, { deadlineMs: 300, minGapMs: 0 })
    expect(Date.now() - started).toBeLessThan(1_500)
    expect(result.pages).toEqual([])
    expect(state.closeCalls).toBe(1)
  })

  it('rejects when the caller aborts, and still closes the browser', async () => {
    const ctrl = new AbortController()
    state.pageImpl = (_url, signal) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
    setTimeout(() => ctrl.abort(new Error('cancelled')), 100)
    await expect(crawl('https://x.com', undefined, { signal: ctrl.signal, deadlineMs: 10_000, minGapMs: 0 })).rejects.toThrow('cancelled')
    expect(state.closeCalls).toBe(1)
  })

  it('reports progress with incrementing pagesProcessed', async () => {
    const seen: number[] = []
    state.pageImpl = async (url) => (url === 'https://p.com/' ? makePage(url, ['https://p.com/a', 'https://p.com/b']) : makePage(url, []))
    await crawl('https://p.com', (p) => seen.push(p.pagesProcessed), { deadlineMs: 10_000, minGapMs: 0 })
    expect(seen[0]).toBe(0)
    expect(Math.max(...seen)).toBeGreaterThan(0)
  })

  it('honours robots disallow for the start page', async () => {
    state.robots = { allowed: false, crawlDelay: undefined }
    const result = await crawl('https://blocked.com', undefined, { deadlineMs: 5_000, minGapMs: 0 })
    expect(result.pages).toEqual([])
    expect(result.errors[0]).toContain('Blocked by robots.txt')
  })
})

describe('StartSpacer', () => {
  it('reserves slots in order for concurrent callers', async () => {
    const spacer = new StartSpacer(50)
    const signal = new AbortController().signal
    const times: number[] = []
    await Promise.all([0, 1, 2, 3].map(async () => {
      await spacer.acquire(signal)
      times.push(Date.now())
    }))
    times.sort((a, b) => a - b)
    expect(times[3] - times[0]).toBeGreaterThanOrEqual(140)
  })
})
