import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/demo', '/privacy'],
      // Reports describe third-party brands and are shared by link only
      disallow: ['/api/', '/analyze/', '/report/', '/compare'],
    },
  }
}
