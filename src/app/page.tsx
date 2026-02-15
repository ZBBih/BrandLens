'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to start analysis')
        setLoading(false)
        return
      }

      // Redirect to results page
      router.push(`/analyze/${data.id}`)
    } catch {
      setError('Failed to connect to server')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">BrandLens</h1>
          <p className="text-lg text-slate-600">
            Generate comprehensive brand guidelines from any website
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Analyze a Brand</CardTitle>
            <CardDescription>
              Enter a company URL to extract their brand guidelines, colors, typography, and tone of voice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter a URL like nike.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-12 text-lg"
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-lg"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Starting Analysis...
                  </span>
                ) : (
                  'Analyze Brand'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px bg-slate-200 w-12" />
            <span className="text-sm text-slate-400">or</span>
            <div className="h-px bg-slate-200 w-12" />
          </div>
          <Link href="/demo">
            <Button variant="outline" className="gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              See Demo Report
            </Button>
          </Link>
          <p className="text-xs text-slate-400 mt-2">
            See what a brand report looks like instantly
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500 mb-4">
            Analysis typically takes 1-3 minutes
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-400">
            <span>Typography</span>
            <span>Colors</span>
            <span>Tone & Voice</span>
            <span>SEO</span>
            <span>Social Links</span>
            <span>PDF Export</span>
          </div>
        </div>
      </div>
    </div>
  )
}
