/**
 * Brand name extraction
 *
 * Without Brandfetch the report used to be titled with the bare domain
 * ("stripe.com"). Sites declare their own name in several places; take the
 * most explicit one available.
 */

import * as cheerio from 'cheerio'
import type { PageData } from '../crawler'

const MAX_LENGTH = 60
const TITLE_SEPARATORS = /\s+[|–—·•:-]\s+/

function clean(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim()
  return text && text.length <= MAX_LENGTH ? text : undefined
}

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function domainToken(domain: string): string {
  return domain.replace(/^www\./, '').split('.')[0] ?? domain
}

function titleCase(token: string): string {
  return token
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function extractBrandName(pages: PageData[], domain: string): string {
  const home = pages.find(page => {
    try {
      return new URL(page.url).pathname === '/'
    } catch {
      return false
    }
  }) ?? pages[0]
  const token = domainToken(domain)

  if (home) {
    const siteName = clean(home.ogData['site_name'])
    if (siteName) return siteName

    const appName = clean(cheerio.load(home.html || '')('meta[name="application-name" i]').attr('content'))
    if (appName) return appName

    // "Stripe | Financial Infrastructure" -> the part that matches the domain
    const segments = (home.title || '').split(TITLE_SEPARATORS).map(s => s.trim()).filter(Boolean)
    const match = segments.find(segment => {
      const squashed = squash(segment)
      return squashed.length > 0 && (squashed === squash(token) || (squashed.includes(squash(token)) && segment.length <= 30))
    })
    if (match && clean(match)) return clean(match)!
  }

  return titleCase(token) || domain
}
