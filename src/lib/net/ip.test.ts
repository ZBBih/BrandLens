import { describe, expect, it } from 'vitest'
import { isPublicAddress, isIpLiteral } from './ip'

describe('isPublicAddress', () => {
  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '93.184.216.34',
    '2606:4700::1111',
    '2001:4860:4860::8888',
    '[2606:4700::1111]',
    '::ffff:8.8.8.8',
  ])('allows %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(true)
  })

  it.each([
    ['127.0.0.1', 'loopback'],
    ['10.0.0.1', 'private'],
    ['172.16.5.4', 'private'],
    ['192.168.1.1', 'private'],
    ['169.254.169.254', 'link-local / metadata'],
    ['100.64.0.1', 'CGNAT'],
    ['100.100.100.200', 'CGNAT (Alibaba metadata)'],
    ['198.18.0.1', 'benchmarking'],
    ['198.19.255.255', 'benchmarking'],
    ['192.0.0.1', 'IETF protocol assignments'],
    ['192.0.2.1', 'TEST-NET-1'],
    ['198.51.100.1', 'TEST-NET-2'],
    ['203.0.113.1', 'TEST-NET-3'],
    ['240.0.0.1', 'reserved 240/4'],
    ['255.255.255.255', 'broadcast'],
    ['224.0.0.1', 'multicast'],
    ['0.0.0.0', 'unspecified'],
    ['::', 'unspecified v6'],
    ['::1', 'loopback v6'],
    ['[::1]', 'bracketed loopback v6'],
    ['fe80::1', 'link-local v6'],
    ['fd00::1', 'unique local'],
    ['ff02::1', 'multicast v6'],
    ['2001:db8::1', 'documentation'],
    ['2001:10::1', 'ORCHID'],
    ['2001:20::1', 'ORCHIDv2'],
    ['100::1', 'discard'],
    ['::ffff:127.0.0.1', 'IPv4-mapped loopback'],
    ['::ffff:a9fe:a9fe', 'IPv4-mapped metadata'],
    ['::ffff:7f00:1', 'IPv4-mapped loopback (hex)'],
    ['64:ff9b::a9fe:a9fe', 'NAT64'],
    ['64:ff9b::808:808', 'NAT64 even to public'],
    ['2002:7f00:1::', '6to4'],
    ['2001::1', 'Teredo'],
    ['::7f00:1', 'IPv4-compatible'],
    ['fec0::1', 'site-local'],
    ['fe80::1%eth0', 'zone id'],
    ['not-an-ip', 'garbage'],
    ['127.1', 'shorthand is not a literal here'],
  ])('rejects %s (%s)', (ip) => {
    expect(isPublicAddress(ip)).toBe(false)
  })
})

describe('isIpLiteral', () => {
  it('recognizes v4 and v6 literals only', () => {
    expect(isIpLiteral('1.2.3.4')).toBe(true)
    expect(isIpLiteral('[::1]')).toBe(true)
    expect(isIpLiteral('example.com')).toBe(false)
  })
})
