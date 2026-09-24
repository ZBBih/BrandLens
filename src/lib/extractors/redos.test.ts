import { describe, expect, it } from 'vitest'
import { parseHtml } from '../crawler/cheerio'
import { extractGeo } from './geo'
import { extractSocial } from './social'
import { extractSeo } from './seo'
import { extractMarketing } from './marketing'

import { expectLinearTime } from '../test-utils/linear-time'

/**
 * A8: hostile HTML must not freeze the event loop. Each extractor gets the
 * audit's proof inputs, which took seconds before the fix, and must scale
 * linearly with input size (see expectLinearTime for why a ratio, not a
 * millisecond budget). A normal-page fixture proves the same data is still found.
 */

const wrap = (body: string) => `<html><body>${body}</body></html>`

describe('hostile inputs scale linearly', () => {
  it('geo: "1 " + "a street 1 " on /contact', () => {
    expectLinearTime(n => parseHtml(wrap('<p>1 ' + 'a street 1 '.repeat(n) + '</p>'), 'https://a.com/contact'), page => extractGeo([page]), 4000)
  }, 30_000)

  it('geo: footer variant', () => {
    expectLinearTime(n => parseHtml(wrap('<footer>1 ' + 'a street 1 '.repeat(n) + '</footer>'), 'https://a.com/'), page => extractGeo([page]), 4000)
  }, 30_000)

  it('geo: address-class containers and digit runs', () => {
    expectLinearTime(
      n => parseHtml(wrap(('<div class="address">' + '1 '.repeat(90) + 'x</div>').repeat(n) + '<p>' + '1'.repeat(n * 200) + '</p>'), 'https://a.com/locations'),
      page => extractGeo([page]),
      125
    )
  }, 30_000)

  it('social: <a href=" + "instagram.com/"', () => {
    expectLinearTime(n => parseHtml(wrap('<a href="' + 'instagram.com/'.repeat(n)), 'https://a.com/'), page => extractSocial([page]), 8000)
  }, 30_000)

  it('social: many unterminated <a attributes', () => {
    expectLinearTime(n => parseHtml(wrap('<a x'.repeat(n)), 'https://a.com/'), page => extractSocial([page]), 12500)
  }, 30_000)

  it('seo: "1 " + "a Street "', () => {
    expectLinearTime(n => parseHtml(wrap('1 ' + 'a Street '.repeat(n)), 'https://a.com/'), page => extractSeo([page]), 10000)
  }, 30_000)

  it('marketing: whitespace runs inside newsletter/lead-magnet phrases', () => {
    expectLinearTime(
      n => parseHtml(wrap('sign up for' + ' '.repeat(n) + '! get' + ' '.repeat(n) + '! download our' + ' '.repeat(n / 2) + '!'), 'https://a.com/'),
      page => extractMarketing([page]),
      25000
    )
  }, 30_000)
})

describe('normal pages still extract the same data', () => {
  const contactHtml = `<!doctype html><html><head><title>Acme Coffee</title>
    <script type="application/ld+json">{"@type":"LocalBusiness","name":"Acme","address":{"streetAddress":"500 Main Street","addressLocality":"Springfield","addressRegion":"IL","postalCode":"62701"}}</script>
    </head><body>
    <header><nav><a href="/about">About</a></nav></header>
    <main>
      <h1>Contact us</h1>
      <p>Visit our flagship store at 1830 E Colonial Dr, Orlando, FL 32803 or call (407) 555-0123.</p>
      <div class="location-address">4498 N Alafaya Trail #324 Orlando FL 32826</div>
      <p>Sign up for our newsletter to get the latest news. Download our free guide today.</p>
      <p>Trusted by 10,000 teams. What our customers say about us.</p>
      <button>Get started</button>
      <iframe src="https://www.google.com/maps/embed?pb=1"></iframe>
    </main>
    <footer>
      <a href="https://www.instagram.com/acmecoffee">Instagram</a>
      <a class="x" href="https://twitter.com/acmecoffee" target="_blank">Twitter</a>
      <a href='https://www.linkedin.com/company/acme-coffee/'>LinkedIn</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=x">Share</a>
      <a href="https://www.youtube.com/@acmecoffee">YouTube</a>
      <a href="https://www.tiktok.com/@acmecoffee">TikTok</a>
      <p>Acme Coffee, 1830 E Colonial Dr, Orlando, FL 32803. Phone: 407-555-0123</p>
    </footer>
    </body></html>`

  const page = parseHtml(contactHtml, 'https://acme.com/contact')

  it('geo finds the addresses and phone numbers', () => {
    const geo = extractGeo([page])
    expect(geo.addresses).toContain('1830 E Colonial Dr, Orlando FL, 32803')
    expect(geo.addresses).toContain('4498 N Alafaya Trail #324, Orlando FL, 32826')
    expect(geo.addresses).toContain('500 Main Street, Springfield IL, 62701')
    expect(geo.phoneNumbers.some(p => p.replace(/\D/g, '').endsWith('4075550123'))).toBe(true)
    expect(geo.hasGoogleMaps).toBe(true)
    expect(geo.hasLocalBusinessSchema).toBe(true)
  })

  it('social finds each profile link and skips share links', () => {
    const social = extractSocial([page])
    const byPlatform = Object.fromEntries(social.links.map(l => [l.platform, l.url]))
    expect(byPlatform.instagram).toBe('https://www.instagram.com/acmecoffee')
    expect(byPlatform.twitter).toBe('https://twitter.com/acmecoffee')
    expect(byPlatform.linkedin).toBe('https://www.linkedin.com/company/acme-coffee')
    expect(byPlatform.youtube).toBe('https://www.youtube.com/@acmecoffee')
    expect(byPlatform.tiktok).toBe('https://www.tiktok.com/@acmecoffee')
    expect(byPlatform.facebook).toBeUndefined()
  })

  it('seo detects local signals (address or phone) when schema is missing', () => {
    const noSchema = (html: string) => html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '')
    const withAddress = parseHtml(noSchema(contactHtml), 'https://acme.com/contact')
    expect(extractSeo([withAddress]).issues.map(i => i.headline)).toContain('Missing LocalBusiness schema')

    const addressOnly = parseHtml(wrap('<p>Visit us at 500 Main Street, Springfield, IL 62701 today.</p>'), 'https://acme.com/')
    expect(extractSeo([addressOnly]).issues.map(i => i.headline)).toContain('Missing LocalBusiness schema')

    const nothing = parseHtml(wrap('<p>We are an online-only company.</p>'), 'https://acme.com/')
    expect(extractSeo([nothing]).issues.map(i => i.headline)).not.toContain('Missing LocalBusiness schema')
  })

  it('marketing finds newsletter, lead magnet, trust and CTA elements', () => {
    const m = extractMarketing([page])
    const json = JSON.stringify(m).toLowerCase()
    expect(json).toContain('sign up for our newsletter')
    expect(json).toContain('download our free')
    expect(json).toContain('trusted by')
    expect(json).toContain('get started')
  })
})
