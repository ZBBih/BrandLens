/**
 * Client IP resolution behind trusted reverse proxies
 *
 * A proxy appends the address it received the request from to
 * X-Forwarded-For, so everything to the left of the entries our own proxies
 * added is client-controlled. With TRUSTED_PROXY_HOPS proxies in front of the
 * app, the real client is that many entries from the right (A5). Vercel
 * replaces X-Forwarded-For with the connecting client's address, so the
 * default of 1 is correct there.
 */

const DEFAULT_TRUSTED_PROXY_HOPS = 1

function trustedHops(): number {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_TRUSTED_PROXY_HOPS
}

export function getClientIp(headers: Headers): string {
  const hops = trustedHops()
  const forwarded = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map(part => part.trim())
    .filter(Boolean)

  if (hops > 0 && forwarded && forwarded.length >= hops) {
    return forwarded[forwarded.length - hops]
  }

  return headers.get('x-real-ip')?.trim() || 'unknown'
}
