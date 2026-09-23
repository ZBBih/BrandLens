import { describe, expect, it } from 'vitest'
import { extractBrandName } from './brand-name'
import { makePage } from './__fixtures__/pages'

describe('extractBrandName', () => {
  it('prefers og:site_name', () => {
    const page = makePage({ url: 'https://www.airbnb.com/', ogData: { site_name: 'Airbnb' }, title: 'Vacation rentals, cabins & more - Airbnb' })
    expect(extractBrandName([page], 'airbnb.com')).toBe('Airbnb')
  })

  it('uses application-name when there is no site name', () => {
    const page = makePage({ url: 'https://acme.com/', html: '<html><head><meta name="application-name" content="Acme Cloud"></head></html>' })
    expect(extractBrandName([page], 'acme.com')).toBe('Acme Cloud')
  })

  it('picks the title segment that matches the domain', () => {
    const page = makePage({ url: 'https://stripe.com/', title: 'Stripe | Financial Infrastructure to Grow Your Revenue' })
    expect(extractBrandName([page], 'stripe.com')).toBe('Stripe')
    const reversed = makePage({ url: 'https://www.notion.com/', title: 'Your connected workspace for wiki, docs & projects | Notion' })
    expect(extractBrandName([reversed], 'notion.com')).toBe('Notion')
  })

  it('falls back to the capitalised domain rather than the raw hostname', () => {
    const page = makePage({ url: 'https://my-bakery.co.uk/', title: 'Home' })
    expect(extractBrandName([page], 'my-bakery.co.uk')).toBe('My Bakery')
  })
})
