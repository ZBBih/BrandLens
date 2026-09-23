/**
 * Capped, cached text views of a crawled page for the regex-based
 * extractors (audit A8).
 *
 * Extractors used to run regexes over the raw HTML (up to megabytes of
 * markup and inline scripts). Here the page is parsed once with cheerio and
 * reduced to what the regexes actually target: visible text (whitespace
 * collapsed), user-facing attribute text, and href values. Every view is
 * capped, so regex work per page is bounded. Results are cached per
 * PageData object; the DOM itself is not kept.
 */

import * as cheerio from 'cheerio'
import type { PageData } from './cheerio'

/** Max characters of visible text kept per page. */
export const MAX_TEXT_CHARS = 200_000
/** Max characters of attribute text kept per page. */
const MAX_ATTR_CHARS = 50_000
/** Max hrefs kept per page, and max length of each. */
const MAX_HREFS = 5_000
const MAX_HREF_LENGTH = 2_048

export interface PageText {
  /** Body text without script/style/noscript/iframe/svg, whitespace collapsed. */
  visibleText: string
  /** placeholder / aria-label / title / alt / button value text, space-joined. */
  attributeText: string
  /** href values of <a> elements, in document order. */
  anchorHrefs: string[]
  /** href values of every element with an href (a, link, area), in document order. */
  allHrefs: string[]
}

const cache = new WeakMap<PageData, PageText>()

/**
 * Get (and cache) the capped text views of a page.
 */
export function getPageText(page: PageData): PageText {
  const hit = cache.get(page)
  if (hit) return hit

  const $ = cheerio.load(page.html)

  const anchorHrefs: string[] = []
  const allHrefs: string[] = []
  $('[href]').each((_, el) => {
    if (allHrefs.length >= MAX_HREFS) return false
    const href = $(el).attr('href')
    if (!href || href.length > MAX_HREF_LENGTH) return
    allHrefs.push(href)
    if (el.type === 'tag' && el.tagName === 'a') anchorHrefs.push(href)
  })

  const attrParts: string[] = []
  let attrLength = 0
  $('[placeholder], [aria-label], [title], img[alt], input[type="submit"][value], button[value]').each((_, el) => {
    for (const name of ['placeholder', 'aria-label', 'title', 'alt', 'value']) {
      const v = $(el).attr(name)
      if (v) {
        attrParts.push(v)
        attrLength += v.length + 1
      }
    }
    if (attrLength >= MAX_ATTR_CHARS) return false
  })

  $('script, style, noscript, iframe, svg, path, template').remove()
  const visibleText = collapse($('body').text()).slice(0, MAX_TEXT_CHARS)

  const result: PageText = {
    visibleText,
    attributeText: collapse(attrParts.join(' ')).slice(0, MAX_ATTR_CHARS),
    anchorHrefs,
    allHrefs,
  }
  cache.set(page, result)
  return result
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
