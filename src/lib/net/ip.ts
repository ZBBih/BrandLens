/**
 * IP address classification for the egress guard (audit A1, A2).
 *
 * Only globally routable unicast addresses are allowed. Everything else
 * (loopback, private, link-local, CGNAT, benchmarking, TEST-NETs, multicast,
 * reserved, documentation, ORCHID, discard, ...) is rejected. IPv6 forms that
 * embed an IPv4 address are either unwrapped and re-checked (IPv4-mapped) or
 * rejected outright (NAT64, 6to4, Teredo), because the embedded address
 * decides where the packet actually goes.
 */

import ipaddr from 'ipaddr.js'

/** IPv6 global unicast is 2000::/3; nothing outside it is publicly routable. */
const IPV6_GLOBAL_UNICAST = ipaddr.IPv6.parse('2000::')

/**
 * Parse an address string, accepting bracketed IPv6 as found in URL hosts.
 * Returns null when the input is not an IP literal.
 */
export function parseIp(input: string): ipaddr.IPv4 | ipaddr.IPv6 | null {
  let value = input.trim()
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
  // Zone IDs (fe80::1%eth0) are never public.
  if (value.includes('%')) return null
  if (!ipaddr.isValid(value)) return null
  // ipaddr.isValid accepts shorthand IPv4 such as "127.1" or "0x7f.1"; only
  // treat strict dotted-quad or valid IPv6 as literals here. WHATWG URL
  // parsing has already canonicalised hostnames like "0x7f.1" to "127.0.0.1".
  if (!value.includes(':') && !ipaddr.IPv4.isValidFourPartDecimal(value)) return null
  try {
    return ipaddr.parse(value)
  } catch {
    return null
  }
}

/**
 * True when the string is an IP literal (v4 dotted quad or v6, brackets allowed).
 */
export function isIpLiteral(input: string): boolean {
  return parseIp(input) !== null
}

/**
 * True only for globally routable unicast addresses.
 * Invalid input returns false.
 */
export function isPublicAddress(input: string): boolean {
  const addr = parseIp(input)
  if (!addr) return false
  return isPublicParsed(addr)
}

function isPublicParsed(addr: ipaddr.IPv4 | ipaddr.IPv6): boolean {
  if (addr.kind() === 'ipv4') {
    // ipaddr.js classifies 198.18/15, 192.0.0/24, TEST-NETs, 240/4 and
    // 192.88.99/24 as 'reserved', 100.64/10 as 'carrierGradeNat', and so on.
    // Anything that is not plain 'unicast' is rejected.
    return (addr as ipaddr.IPv4).range() === 'unicast'
  }

  const v6 = addr as ipaddr.IPv6
  const range = v6.range()

  // IPv4-mapped (::ffff:a.b.c.d): decide by the embedded IPv4 address.
  if (range === 'ipv4Mapped') {
    return isPublicParsed(v6.toIPv4Address())
  }

  // NAT64 (64:ff9b::/96, 64:ff9b:1::/48), 6to4 (2002::/16) and Teredo
  // (2001::/32) tunnel to an embedded IPv4 destination. Reject them outright.
  if (range === 'rfc6052' || range === '6to4' || range === 'teredo') {
    return false
  }

  if (range !== 'unicast') return false

  // ipaddr.js reports some legacy space (e.g. IPv4-compatible ::a.b.c.d) as
  // 'unicast'. Require the address to sit inside 2000::/3.
  return v6.match(IPV6_GLOBAL_UNICAST, 3)
}
