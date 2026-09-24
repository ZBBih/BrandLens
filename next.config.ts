import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Images are plain <img> tags from arbitrary brand hosts; the optimizer
  // endpoint is unused, so it is switched off rather than left exposed
  images: { unoptimized: true },
  serverExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium', '@react-pdf/renderer'],
  // Files read from disk at runtime, which the bundler cannot see
  outputFileTracingIncludes: {
    '/api/analyze': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/pdf/[id]': ['./node_modules/@fontsource/noto-sans/package.json', './node_modules/@fontsource/noto-sans/files/*-normal.woff', './node_modules/@fontsource/noto-sans/files/*-italic.woff'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
