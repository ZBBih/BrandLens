/**
 * Test fixtures: minimal PageData builders shared by extractor tests
 */

import type { PageData } from '../../crawler'

/**
 * Build a PageData object with sensible empty defaults
 */
export function makePage(overrides: Partial<PageData> & { url: string }): PageData {
  return {
    html: '<html><head></head><body></body></html>',
    title: '',
    description: '',
    keywords: [],
    ogData: {},
    twitterData: {},
    headings: [],
    links: [],
    images: [],
    cssUrls: [],
    inlineCss: [],
    navLabels: [],
    ctaButtons: [],
    footerContent: '',
    schemaData: [],
    ...overrides,
  }
}

/**
 * Build the cssContents map the extractors consume
 */
export function cssMap(entries: Record<string, string[]>): Map<string, string[]> {
  return new Map(Object.entries(entries))
}
