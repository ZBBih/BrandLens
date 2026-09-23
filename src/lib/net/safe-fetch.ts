/**
 * safeFetch: the single guarded outbound HTTP client (audit A1, A2, A24, A27, G18).
 *
 * Every request the crawler makes (HTML, CSS, robots.txt, sitemaps, and every
 * request Chromium issues through page routing) goes through this module.
 *
 * Guarantees:
 * - Only http/https, only ports 80/443, userinfo stripped.
 * - DNS is resolved by us, EVERY resolved address must be public, and the
 *   socket is opened to one of those vetted addresses. The connection is
 *   pinned to the checked IP, which defeats DNS rebinding.
 * - Redirects are either returned to the caller ('manual') or followed here
 *   ('follow'), re-validating every hop, at most 5 hops.
 * - Bodies are streamed with a byte cap (decompressed bytes, so gzip bombs
 *   are capped too) under one combined timeout + caller abort signal.
 */

import dns from 'node:dns'
import net from 'node:net'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import { Agent, buildConnector, fetch as undiciFetch } from 'undici'
import { isPublicAddress, parseIp } from './ip'

/** The one crawler User-Agent, used for every outbound request (G18). */
export const USER_AGENT = 'BrandLens/1.0 (+https://github.com/zbweiss/brandlens)'

const DEFAULT_MAX_BYTES = 3 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 15_000
const MAX_REDIRECTS = 5
const ALLOWED_PORTS = new Set([80, 443])

export type SafeFetchErrorCode =
  | 'BLOCKED_URL'
  | 'BLOCKED_ADDRESS'
  | 'DNS_FAILURE'
  | 'TOO_MANY_REDIRECTS'
  | 'BAD_CONTENT_TYPE'

/**
 * Raised when the guard refuses a request. Network failures, timeouts and
 * aborts surface as the underlying error instead.
 */
export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode
  constructor(code: SafeFetchErrorCode, message: string) {
    super(message)
    this.name = 'SafeFetchError'
    this.code = code
  }
}

export interface SafeFetchOptions {
  /** 'follow' (default) re-validates and follows up to 5 hops; 'manual' returns the 3xx. */
  redirect?: 'follow' | 'manual'
  /** Byte cap on the (decompressed) body. Default 3 MB. */
  maxBytes?: number
  /** Overall timeout covering every hop and the body read. Default 15 s. */
  timeoutMs?: number
  /** Caller abort signal, combined with the timeout. */
  signal?: AbortSignal
  /**
   * Allowed response MIME types (lowercase, no parameters). Include '' to
   * accept a missing Content-Type. Only checked on non-redirect responses.
   */
  accept?: string[]
  method?: string
  headers?: Record<string, string>
  body?: string | Uint8Array
}

export interface SafeFetchResponse {
  /** Final URL after any followed redirects. */
  url: string
  status: number
  /** Response headers, lowercase names. Multiple values are joined with ', '. */
  headers: Record<string, string>
  body: Buffer
  /** True when the body hit maxBytes and was cut off. */
  truncated: boolean
  /** Body decoded as UTF-8. */
  text(): string
}

export interface ResolvedAddress {
  address: string
  family: number
}

export interface SafeFetchPolicy {
  /** Resolver; defaults to dns.lookup(host, { all: true }). */
  lookup?: (hostname: string) => Promise<ResolvedAddress[]>
  /** Address policy; defaults to isPublicAddress. */
  isAllowedAddress?: (address: string, target: { hostname: string; port: number }) => boolean
  /** Port policy; defaults to 80/443 only. */
  isAllowedPort?: (port: number) => boolean
}

async function defaultLookup(hostname: string): Promise<ResolvedAddress[]> {
  return dns.promises.lookup(hostname, { all: true })
}

type ConnectOptions = Parameters<ReturnType<typeof buildConnector>>[0]
type ConnectCallback = Parameters<ReturnType<typeof buildConnector>>[1]

/**
 * Build a safeFetch bound to a policy. Production code uses the default
 * export `safeFetch`; tests inject a resolver and policy.
 */
export function createSafeFetch(policy: SafeFetchPolicy = {}) {
  const lookup = policy.lookup ?? defaultLookup
  const isAllowedAddress = policy.isAllowedAddress ?? ((address: string) => isPublicAddress(address))
  const isAllowedPort = policy.isAllowedPort ?? ((port: number) => ALLOWED_PORTS.has(port))

  const baseConnect = buildConnector({ timeout: 10_000 })

  /**
   * Resolve the target, reject if ANY address is not allowed, then connect
   * to a vetted address. SNI and certificate checks still use the hostname
   * (undici derives servername from `host`).
   */
  function guardedConnect(opts: ConnectOptions, callback: ConnectCallback): void {
    const hostname = opts.hostname.replace(/^\[|\]$/g, '')
    const port = Number(opts.port) || (opts.protocol === 'https:' ? 443 : 80)

    const resolve: Promise<ResolvedAddress[]> = net.isIP(hostname)
      ? Promise.resolve([{ address: hostname, family: net.isIP(hostname) }])
      : lookup(hostname)

    resolve.then(
      (addresses) => {
        if (addresses.length === 0) {
          callback(new SafeFetchError('DNS_FAILURE', `No addresses for ${hostname}`), null)
          return
        }
        const bad = addresses.find(a => !isAllowedAddress(a.address, { hostname, port }))
        if (bad) {
          callback(new SafeFetchError('BLOCKED_ADDRESS', `${hostname} resolves to a non-public address (${bad.address})`), null)
          return
        }
        // Prefer IPv4 (IPv6 egress is often missing on PaaS hosts), then fall
        // back through the remaining vetted addresses on connect failure.
        const ordered = [...addresses].sort((a, b) => a.family - b.family)
        const attempt = (i: number) => {
          baseConnect({ ...opts, hostname: ordered[i].address }, (err, socket) => {
            if (err && i + 1 < ordered.length && i < 2) {
              attempt(i + 1)
              return
            }
            if (err) callback(err, null)
            else callback(null, socket!)
          })
        }
        attempt(0)
      },
      (err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        callback(new SafeFetchError('DNS_FAILURE', `DNS lookup failed for ${hostname}: ${message}`), null)
      }
    )
  }

  const dispatcher = new Agent({
    connect: guardedConnect,
    connections: 16,
    keepAliveTimeout: 4_000,
  })

  /**
   * Validate one hop's URL: scheme, port, IP-literal policy. Strips userinfo.
   */
  function checkUrl(raw: string): URL {
    let url: URL
    try {
      url = new URL(raw)
    } catch {
      throw new SafeFetchError('BLOCKED_URL', `Invalid URL: ${raw}`)
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new SafeFetchError('BLOCKED_URL', `Only http and https are allowed: ${url.protocol}`)
    }
    const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80)
    if (!isAllowedPort(port)) {
      throw new SafeFetchError('BLOCKED_URL', `Port ${port} is not allowed`)
    }
    url.username = ''
    url.password = ''
    url.hash = ''
    const ip = parseIp(url.hostname)
    if (ip && !isAllowedAddress(ip.toString(), { hostname: url.hostname, port })) {
      throw new SafeFetchError('BLOCKED_ADDRESS', `Address ${url.hostname} is not allowed`)
    }
    return url
  }

  return async function safeFetch(input: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
    const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const signals = [AbortSignal.timeout(timeoutMs)]
    if (opts.signal) signals.push(opts.signal)
    const signal = AbortSignal.any(signals)

    let method = (opts.method ?? 'GET').toUpperCase()
    let body = opts.body
    let current = checkUrl(input)

    for (let hop = 0; ; hop++) {
      signal.throwIfAborted()
      const headers: Record<string, string> = {
        'user-agent': USER_AGENT,
        ...lowercaseKeys(opts.headers ?? {}),
      }

      let res: Awaited<ReturnType<typeof undiciFetch>>
      try {
        res = await undiciFetch(current.toString(), {
          method,
          headers,
          body: method === 'GET' || method === 'HEAD' ? undefined : body,
          redirect: 'manual',
          signal,
          dispatcher,
        })
      } catch (err) {
        throw unwrapFetchError(err)
      }

      const location = res.headers.get('location')
      const isRedirect = res.status >= 300 && res.status < 400 && location !== null

      if (isRedirect && opts.redirect !== 'manual') {
        await res.body?.cancel().catch(() => {})
        if (hop + 1 > MAX_REDIRECTS) {
          throw new SafeFetchError('TOO_MANY_REDIRECTS', `More than ${MAX_REDIRECTS} redirects`)
        }
        current = checkUrl(new URL(location, current).toString())
        if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
          method = 'GET'
          body = undefined
        }
        continue
      }

      const responseHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      if (!isRedirect && opts.accept) {
        const mime = (responseHeaders['content-type'] ?? '').split(';')[0].trim().toLowerCase()
        if (!opts.accept.includes(mime)) {
          await res.body?.cancel().catch(() => {})
          throw new SafeFetchError('BAD_CONTENT_TYPE', `Unexpected content type "${mime}"`)
        }
      }

      const { buffer, truncated } = await readCapped(res.body, maxBytes, signal)
      return {
        url: current.toString(),
        status: res.status,
        headers: responseHeaders,
        body: buffer,
        truncated,
        text: () => buffer.toString('utf8'),
      }
    }
  }
}

function lowercaseKeys(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) out[k.toLowerCase()] = v
  return out
}

/**
 * undici wraps connector errors in TypeError('fetch failed'); surface ours.
 */
function unwrapFetchError(err: unknown): unknown {
  let e: unknown = err
  for (let i = 0; i < 4 && e instanceof Error; i++) {
    if (e instanceof SafeFetchError) return e
    e = (e as Error & { cause?: unknown }).cause
  }
  return err
}

/**
 * Read a body stream, stopping at maxBytes. Aborts the stream when the cap is hit.
 */
async function readCapped(
  stream: NodeReadableStream<Uint8Array> | null,
  maxBytes: number,
  signal: AbortSignal
): Promise<{ buffer: Buffer; truncated: boolean }> {
  if (!stream) return { buffer: Buffer.alloc(0), truncated: false }
  const reader = stream.getReader()
  const chunks: Buffer[] = []
  let total = 0
  let truncated = false
  const onAbort = () => {
    reader.cancel().catch(() => {})
  }
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      signal.throwIfAborted()
      const remaining = maxBytes - total
      if (value.byteLength > remaining) {
        if (remaining > 0) chunks.push(Buffer.from(value.buffer, value.byteOffset, remaining))
        total = maxBytes
        truncated = true
        await reader.cancel().catch(() => {})
        break
      }
      chunks.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength))
      total += value.byteLength
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
  signal.throwIfAborted()
  return { buffer: Buffer.concat(chunks, total), truncated }
}

/** The production guard: public addresses only, ports 80/443. */
export const safeFetch = createSafeFetch()
