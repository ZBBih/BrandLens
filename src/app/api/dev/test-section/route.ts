/**
 * POST /api/dev/test-section
 * Test individual extraction functions
 * Only works in development mode
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateUrl } from '@/lib/utils/url'
import { crawl } from '@/lib/crawler'
import {
  extractTypography,
  extractColors,
  extractSeo,
  extractGeo,
  extractSocial,
  extractMarketing,
} from '@/lib/extractors'
import { analyzeToneVoice } from '@/lib/analysis/tone-voice'

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Dev routes only available in development mode' },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()
    const { url, section } = body

    if (!url || !section) {
      return NextResponse.json(
        { error: 'URL and section are required' },
        { status: 400 }
      )
    }

    // Validate URL
    const validation = validateUrl(url)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    const normalizedUrl = validation.url!

    // Crawl the site (limited for dev testing)
    console.log(`[DEV TEST] Crawling ${normalizedUrl} for section: ${section}`)
    // Note: crawl uses defaults of MAX_PAGES=25, MAX_DEPTH=2
    // For dev testing, we accept these defaults for now
    const crawlResult = await crawl(normalizedUrl)

    if (crawlResult.pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages could be crawled' },
        { status: 400 }
      )
    }

    let result: unknown = null
    const startTime = Date.now()

    switch (section) {
      case 'typography':
        result = extractTypography(crawlResult.pages, crawlResult.cssContents)
        break

      case 'colors':
        result = extractColors(crawlResult.pages, crawlResult.cssContents)
        break

      case 'seo':
        result = extractSeo(crawlResult.pages)
        break

      case 'geo':
        result = extractGeo(crawlResult.pages)
        break

      case 'social':
        result = extractSocial(crawlResult.pages)
        break

      case 'marketing':
        result = extractMarketing(crawlResult.pages)
        break

      case 'tone':
        result = await analyzeToneVoice(crawlResult.pages)
        break

      default:
        return NextResponse.json(
          { error: `Unknown section: ${section}` },
          { status: 400 }
        )
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      section,
      url: normalizedUrl,
      pagesAnalyzed: crawlResult.pages.length,
      duration: `${duration}ms`,
      result,
    })
  } catch (error) {
    console.error('[DEV TEST] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Test failed' },
      { status: 500 }
    )
  }
}
