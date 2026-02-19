'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CacheEntry {
  domain: string
  cachedAt: string
}

interface MockDomain {
  domain: string
}

interface DevStatus {
  mockMode: boolean
  skipAiInsights: boolean
  localCacheEntries: CacheEntry[]
  mockDomains: MockDomain[]
}

export default function DevTestPage() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState('')
  const [devStatus, setDevStatus] = useState<DevStatus | null>(null)
  const [skipAi, setSkipAi] = useState(false)
  const [useCache, setUseCache] = useState(false)

  // Check if we're in development mode
  useEffect(() => {
    fetch('/api/dev/status')
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          router.push('/')
        } else {
          setDevStatus(data)
          setSkipAi(data.skipAiInsights)
        }
      })
      .catch(() => router.push('/'))
  }, [router])

  const testSection = async (section: string) => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setError('')
    setLoading(section)
    setResult(null)

    try {
      const response = await fetch('/api/dev/test-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), section }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Test failed')
      } else {
        setResult(data)
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(null)
    }
  }

  const runFullAnalysis = async () => {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setError('')
    setLoading('full')

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          skipAiInsights: skipAi,
          useLocalCache: useCache,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Analysis failed')
        setLoading(null)
      } else if (data.mock || data.localCache) {
        // Instant result from mock/cache
        setResult(data.report)
        setLoading(null)
      } else {
        // Redirect to analysis page
        router.push(`/analyze/${data.id}`)
      }
    } catch {
      setError('Failed to connect to server')
      setLoading(null)
    }
  }

  const loadMockReport = async (domain: string) => {
    setUrl(domain)
    setLoading('mock')
    setError('')

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: domain }),
      })

      const data = await response.json()
      if (data.report) {
        setResult(data.report)
      } else {
        router.push(`/analyze/${data.id}`)
      }
    } catch {
      setError('Failed to load mock report')
    } finally {
      setLoading(null)
    }
  }

  const loadCachedReport = async (domain: string) => {
    setUrl(domain)
    setLoading('cache')
    setError('')

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: domain, useLocalCache: true }),
      })

      const data = await response.json()
      if (data.report) {
        setResult(data.report)
      }
    } catch {
      setError('Failed to load cached report')
    } finally {
      setLoading(null)
    }
  }

  const clearCache = async () => {
    try {
      await fetch('/api/dev/clear-cache', { method: 'POST' })
      // Refresh status
      const response = await fetch('/api/dev/status')
      const data = await response.json()
      setDevStatus(data)
    } catch {
      setError('Failed to clear cache')
    }
  }

  if (!devStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    )
  }

  const sections = [
    { id: 'typography', label: 'Typography', description: 'Extract fonts and typography settings' },
    { id: 'colors', label: 'Colors', description: 'Extract color palette' },
    { id: 'seo', label: 'SEO', description: 'Analyze SEO settings and meta tags' },
    { id: 'social', label: 'Social Links', description: 'Find social media links' },
    { id: 'geo', label: 'Geo/Contact', description: 'Extract addresses and phone numbers' },
    { id: 'marketing', label: 'Marketing', description: 'Find CTAs and marketing elements' },
    { id: 'tone', label: 'Tone & Voice', description: 'Analyze brand voice (uses Claude API)' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
              DEV MODE
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Developer Testing</h1>
          </div>
          <p className="text-slate-600">Test individual extraction functions without running full analysis</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* URL Input */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test URL</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  type="text"
                  placeholder="Enter URL (e.g., nike.com)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full"
                />

                {/* Options */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={skipAi}
                      onChange={(e) => setSkipAi(e.target.checked)}
                      className="rounded"
                    />
                    Skip AI Insights
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={useCache}
                      onChange={(e) => setUseCache(e.target.checked)}
                      className="rounded"
                    />
                    Use Local Cache
                  </label>
                </div>

                <Button
                  onClick={runFullAnalysis}
                  disabled={loading !== null}
                  className="w-full bg-indigo-500 hover:bg-indigo-600"
                >
                  {loading === 'full' ? 'Running...' : 'Run Full Analysis'}
                </Button>

                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
              </CardContent>
            </Card>

            {/* Mock Data */}
            {devStatus.mockMode && devStatus.mockDomains.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Mock Data</CardTitle>
                  <CardDescription>Instant results (no API calls)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {devStatus.mockDomains.map(({ domain }) => (
                    <Button
                      key={domain}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => loadMockReport(domain)}
                      disabled={loading !== null}
                    >
                      {domain}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Local Cache */}
            {devStatus.localCacheEntries.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Local Cache</CardTitle>
                  <CardDescription>Previously analyzed sites</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {devStatus.localCacheEntries.map((entry) => (
                    <div key={entry.domain} className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 justify-start mr-2"
                        onClick={() => loadCachedReport(entry.domain)}
                        disabled={loading !== null}
                      >
                        <span className="truncate">{entry.domain}</span>
                      </Button>
                      <span className="text-xs text-slate-400">
                        {new Date(entry.cachedAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={clearCache}
                  >
                    Clear All Cache
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Test Individual Sections */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Test Sections</CardTitle>
                <CardDescription>Run individual extractors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {sections.map((section) => (
                  <Button
                    key={section.id}
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    onClick={() => testSection(section.id)}
                    disabled={loading !== null || !url.trim()}
                  >
                    <span>{section.label}</span>
                    {loading === section.id && (
                      <span className="animate-spin">...</span>
                    )}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dev Status</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>
                  <span className="text-slate-500">Mock Mode:</span>{' '}
                  <span className={devStatus.mockMode ? 'text-green-600' : 'text-slate-400'}>
                    {devStatus.mockMode ? 'Enabled' : 'Disabled'}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">Skip AI (env):</span>{' '}
                  <span className={devStatus.skipAiInsights ? 'text-green-600' : 'text-slate-400'}>
                    {devStatus.skipAiInsights ? 'Yes' : 'No'}
                  </span>
                </p>
                <p>
                  <span className="text-slate-500">Cached Reports:</span>{' '}
                  {devStatus.localCacheEntries.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Results</CardTitle>
              </CardHeader>
              <CardContent>
                {result ? (
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-[70vh] text-xs">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                ) : (
                  <div className="text-center text-slate-400 py-20">
                    Run a test to see results here
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
