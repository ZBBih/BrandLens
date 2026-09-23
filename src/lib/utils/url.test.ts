import { describe, expect, it } from 'vitest'
import { getDomainName, isSameOrigin, isSameSite, validatePublicUrl, validateUrl } from './url'

/**
 * Every input from the audit's v.ts probe, with the expected verdict (A2, A49, A50).
 */
const BLOCKED = [
  'http://0x7f.1/',
  'http://0x7f000001/',
  'http://2130706433/',
  'http://017700000001/',
  'http://127.1/',
  'http://[::ffff:127.0.0.1]/',
  'http://[::ffff:a9fe:a9fe]/',
  'http://[::1]/',
  'http://[0:0:0:0:0:0:0:1]/',
  'http://localhost./',
  'http://LOCALHOST./',
  'http://169.254.169.254/latest/meta-data/',
  'http://0xa9fea9fe/',
  'http://2852039166/',
  'http://169.254.169.254./',
  'http://100.100.100.200/',
  'http://100.64.0.1/',
  'http://[fd00::1]/',
  'http://[fe80::1]/',
  'http://[::]/',
  'http://0/',
  'http://metadata.google.internal/',
  'http://foo.localhost/',
  'http://[64:ff9b::a9fe:a9fe]/',
  'http://user@127.0.0.1/',
  'http://example.com:6379/',
  'http://[::ffff:7f00:1]/',
  'http://198.18.0.1/',
  'file:///etc/passwd',
  'ftp://example.com',
  // Additional local names
  'http://localhost/',
  'http://intranet/',
  'http://printer.local/',
  'http://nas.lan/',
  'http://router.home.arpa/',
  'http://svc.corp/',
  'http://wiki.intranet/',
  'localhost:3000',
  'https://example.com:8443/',
]

/** Hostnames: sync validation cannot see DNS, so these pass here and are caught by validatePublicUrl/safeFetch. */
const ALLOWED_SYNC = [
  'http://127.0.0.1.nip.io/',
  'http://192.168.1.1.nip.io/',
  'http://api.example.com/',
  'http://admin.shopify.com/',
  'http://nodejs.org/',
  'https://docker.com',
  'masterclass.com',
  'api.stripe.com',
  'https://example.com:443/',
  'http://example.com:80/',
  'http://8.8.8.8/',
  'localtest.me',
]

describe('validateUrl', () => {
  it.each(BLOCKED)('blocks %s', (input) => {
    const r = validateUrl(input)
    expect(r.valid).toBe(false)
    expect(r.error).toBeTruthy()
  })

  it.each(ALLOWED_SYNC)('allows %s', (input) => {
    const r = validateUrl(input)
    expect(r.valid).toBe(true)
    expect(r.url).toMatch(/^https:\/\//)
  })

  it('no longer blocks real sites by name prefix (A49)', () => {
    for (const host of ['nodejs.org', 'docker.com', 'api.stripe.com', 'admin.shopify.com', 'masterclass.com', 'redis.io', 'grafana.com']) {
      expect(validateUrl(host).valid).toBe(true)
    }
  })

  it('normalizes to https and strips default ports', () => {
    expect(validateUrl('Example.COM/about/').url).toBe('https://example.com/about')
    expect(validateUrl('http://example.com:80/').url).toBe('https://example.com/')
  })

  it('rejects empty input', () => {
    expect(validateUrl('  ').valid).toBe(false)
  })
})

describe('validatePublicUrl', () => {
  const table: Record<string, string[]> = {
    'localtest.me': ['127.0.0.1'],
    '127.0.0.1.nip.io': ['127.0.0.1'],
    'rebind.example': ['93.184.216.34', '10.0.0.1'],
    'example.com': ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'],
  }
  const lookup = async (h: string) => {
    const hit = table[h]
    if (!hit) throw new Error('ENOTFOUND')
    return hit.map(address => ({ address }))
  }

  it('rejects names that resolve to loopback (localtest.me)', async () => {
    expect((await validatePublicUrl('localtest.me', lookup)).valid).toBe(false)
    expect((await validatePublicUrl('http://127.0.0.1.nip.io/', lookup)).valid).toBe(false)
  })

  it('rejects when any address is private', async () => {
    expect((await validatePublicUrl('rebind.example', lookup)).valid).toBe(false)
  })

  it('rejects unresolvable names', async () => {
    expect((await validatePublicUrl('nope.example', lookup)).valid).toBe(false)
  })

  it('accepts public names and still applies sync checks', async () => {
    expect((await validatePublicUrl('example.com', lookup))).toEqual({ valid: true, url: 'https://example.com/' })
    expect((await validatePublicUrl('http://100.100.100.200/', lookup)).valid).toBe(false)
  })

  it('rejects localtest.me with the real resolver', async () => {
    expect((await validatePublicUrl('localtest.me')).valid).toBe(false)
  })
})

describe('getDomainName', () => {
  it('strips a leading www. (G12)', () => {
    expect(getDomainName('https://www.Example.com/x')).toBe('example.com')
    expect(getDomainName('https://example.com/')).toBe('example.com')
    expect(getDomainName('https://shop.example.com/')).toBe('shop.example.com')
  })
})

describe('isSameSite', () => {
  it('treats apex and www as the same site, scheme-agnostic (A28)', () => {
    expect(isSameSite('https://acme.com/', 'https://www.acme.com/about')).toBe(true)
    expect(isSameSite('http://acme.com/', 'https://acme.com/')).toBe(true)
  })

  it('requires the same port (A50)', () => {
    expect(isSameSite('https://a.com/', 'http://a.com:6379/')).toBe(false)
    expect(isSameOrigin('https://a.com/', 'http://a.com:6379/')).toBe(false)
    expect(isSameSite('https://a.com:443/', 'https://a.com/')).toBe(true)
  })

  it('rejects other hosts', () => {
    expect(isSameSite('https://a.com/', 'https://b.com/')).toBe(false)
    expect(isSameSite('https://a.com/', 'https://sub.a.com/')).toBe(false)
    expect(isSameSite('not a url', 'https://a.com/')).toBe(false)
  })
})
