import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSafeFetch, safeFetch, SafeFetchError, USER_AGENT } from './safe-fetch'
import { isPublicAddress } from './ip'

/**
 * Two local servers. Server A is the only allowed first hop (via an injected
 * policy); server B stands in for an internal service that must never be hit.
 */
let serverA: http.Server
let serverB: http.Server
let portA = 0
let portB = 0
let hitsB = 0
let lastUserAgent = ''

function listen(server: http.Server): Promise<number> {
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port))
  })
}

beforeAll(async () => {
  serverB = http.createServer((_req, res) => {
    hitsB++
    res.end('internal secret')
  })
  portB = await listen(serverB)

  serverA = http.createServer((req, res) => {
    lastUserAgent = req.headers['user-agent'] ?? ''
    const redirect = (location: string) => {
      res.writeHead(302, { location })
      res.end()
    }
    switch (req.url) {
      case '/ok':
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end('<p>hello</p>')
        return
      case '/redir-ok':
        return redirect('/ok')
      case '/redir-loopback':
        return redirect(`http://127.0.0.1:${portB}/`)
      case '/redir-metadata':
        return redirect('http://169.254.169.254/latest/meta-data/')
      case '/redir-private-name':
        return redirect(`http://private.test:${portB}/`)
      case '/redir-mixed-name':
        return redirect(`http://mixed.test:${portB}/`)
      case '/redir-file':
        return redirect('file:///etc/passwd')
      case '/loop':
        return redirect('/loop')
      case '/big': {
        res.writeHead(200, { 'content-type': 'text/css' })
        const chunk = Buffer.alloc(64 * 1024, 'a')
        let sent = 0
        const pump = () => {
          while (sent < 5 * 1024 * 1024) {
            sent += chunk.length
            if (!res.write(chunk)) {
              res.once('drain', pump)
              return
            }
          }
          res.end()
        }
        res.on('error', () => {})
        pump()
        return
      }
      case '/json':
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end('{}')
        return
      default:
        res.writeHead(404)
        res.end()
    }
  })
  portA = await listen(serverA)
})

afterAll(() => {
  serverA.closeAllConnections()
  serverB.closeAllConnections()
  serverA.close()
  serverB.close()
})

const resolverTable: Record<string, { address: string; family: number }[]> = {
  'first.test': [{ address: '127.0.0.1', family: 4 }],
  'private.test': [{ address: '10.0.0.1', family: 4 }],
  'mixed.test': [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }],
}

/** Allows exactly server A's hop; everything else must be public. */
const testFetch = createSafeFetch({
  lookup: async (hostname) => {
    const hit = resolverTable[hostname]
    if (!hit) throw new Error('ENOTFOUND')
    return hit
  },
  isAllowedAddress: (address, { port }) =>
    (address === '127.0.0.1' && port === portA) || isPublicAddress(address),
  isAllowedPort: () => true,
})

const a = (path: string) => `http://first.test:${portA}${path}`

describe('safeFetch', () => {
  it('fetches an allowed first hop and sends the BrandLens UA', async () => {
    const res = await testFetch(a('/ok'))
    expect(res.status).toBe(200)
    expect(res.text()).toBe('<p>hello</p>')
    expect(res.headers['content-type']).toContain('text/html')
    expect(lastUserAgent).toBe(USER_AGENT)
  })

  it('follows a same-server redirect and reports the final URL', async () => {
    const res = await testFetch(a('/redir-ok'))
    expect(res.status).toBe(200)
    expect(res.url).toBe(a('/ok'))
  })

  it('rejects a 302 to 127.0.0.1 on another port', async () => {
    await expect(testFetch(a('/redir-loopback'))).rejects.toMatchObject({ code: 'BLOCKED_ADDRESS' })
    expect(hitsB).toBe(0)
  })

  it('rejects a 302 to the cloud metadata address', async () => {
    await expect(testFetch(a('/redir-metadata'))).rejects.toMatchObject({ code: 'BLOCKED_ADDRESS' })
  })

  it('rejects a 302 to a hostname that resolves to 10.0.0.1', async () => {
    await expect(testFetch(a('/redir-private-name'))).rejects.toMatchObject({ code: 'BLOCKED_ADDRESS' })
    expect(hitsB).toBe(0)
  })

  it('rejects a hostname when ANY resolved address is non-public', async () => {
    await expect(testFetch(a('/redir-mixed-name'))).rejects.toMatchObject({ code: 'BLOCKED_ADDRESS' })
    expect(hitsB).toBe(0)
  })

  it('rejects a redirect to a non-http scheme', async () => {
    await expect(testFetch(a('/redir-file'))).rejects.toMatchObject({ code: 'BLOCKED_URL' })
  })

  it('stops after 5 redirects', async () => {
    await expect(testFetch(a('/loop'))).rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' })
  })

  it("returns the 3xx to the caller in 'manual' mode", async () => {
    const res = await testFetch(a('/redir-loopback'), { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.location).toBe(`http://127.0.0.1:${portB}/`)
    expect(hitsB).toBe(0)
  })

  it('truncates at the byte cap without buffering the whole body', async () => {
    const res = await testFetch(a('/big'), { maxBytes: 100_000 })
    expect(res.truncated).toBe(true)
    expect(res.body.length).toBe(100_000)
  })

  it('enforces the content-type allowlist', async () => {
    await expect(testFetch(a('/json'), { accept: ['text/css', ''] })).rejects.toMatchObject({ code: 'BAD_CONTENT_TYPE' })
    const ok = await testFetch(a('/ok'), { accept: ['text/html'] })
    expect(ok.status).toBe(200)
  })

  it('honours the caller abort signal', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(testFetch(a('/ok'), { signal: ctrl.signal })).rejects.toThrow()
  })
})

describe('default safeFetch policy', () => {
  it('rejects non-80/443 ports before connecting', async () => {
    await expect(safeFetch('http://example.com:6379/')).rejects.toMatchObject({ code: 'BLOCKED_URL' })
    await expect(safeFetch(`http://127.0.0.1:${portA}/ok`)).rejects.toBeInstanceOf(SafeFetchError)
  })

  it('rejects private IP literals and non-http schemes', async () => {
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toMatchObject({ code: 'BLOCKED_ADDRESS' })
    await expect(safeFetch('http://[::ffff:7f00:1]/')).rejects.toMatchObject({ code: 'BLOCKED_ADDRESS' })
    await expect(safeFetch('file:///etc/passwd')).rejects.toMatchObject({ code: 'BLOCKED_URL' })
  })

  it('rejects names that resolve to loopback (localhost)', async () => {
    await expect(safeFetch('http://localhost/')).rejects.toMatchObject({ code: 'BLOCKED_ADDRESS' })
  })
})
