'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Globe, ScanSearch, FileDown, CheckCircle } from 'lucide-react'

// BrandLens Logo Icon Component
function BrandLensIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lens-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="10" stroke="url(#lens-gradient)" strokeWidth="2.5" fill="none" />
      <circle cx="14" cy="14" r="6" stroke="url(#lens-gradient)" strokeWidth="1.5" fill="none" opacity="0.6" />
      <line x1="21.5" y1="21.5" x2="28" y2="28" stroke="url(#lens-gradient)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2" fill="url(#lens-gradient)" opacity="0.4" />
    </svg>
  )
}

// Nike-style swoosh icon
function SwooshIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 8.719L7.836 14.303C6.74 14.768 5.818 15 5.075 15c-.836 0-1.445-.295-1.819-.884-.485-.76-.273-1.982.559-3.272.494-.754 1.122-1.446 1.734-2.108-.144.234-1.415 2.349-.025 3.345.275.197.63.293 1.055.293.775 0 1.723-.376 2.825-.837L21 8.719z"/>
    </svg>
  )
}

export default function Home() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const howItWorksRef = useRef<HTMLDivElement>(null)

  // Scroll animation observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1 }
    )

    const elements = document.querySelectorAll('.scroll-animate')
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

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
    <div className="min-h-screen animated-gradient-bg flex flex-col items-center justify-start pt-20 md:pt-32 px-4 pb-20">
      <div className="w-full max-w-xl">
        {/* Header with Logo */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BrandLensIcon className="w-10 h-10" />
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900">BrandLens</h1>
          </div>
          <p className="text-lg text-slate-600">
            Generate comprehensive brand guidelines from any website
          </p>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg card-enhanced animate-fade-in-up-delay-1">
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
                  className="h-12 text-lg input-focus-glow"
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-lg btn-hover-lift bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
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

        {/* Trust Badge */}
        <div className="mt-6 text-center animate-fade-in-up-delay-2">
          <div className="inline-flex items-center gap-2 text-slate-500 text-sm">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>Trusted by small business owners</span>
          </div>
        </div>

        {/* Demo Button Section */}
        <div className="mt-8 text-center animate-fade-in-up-delay-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="h-px bg-slate-200 w-12" />
            <span className="text-sm text-slate-400">or</span>
            <div className="h-px bg-slate-200 w-12" />
          </div>
          <Link href="/demo">
            <Button variant="outline" className="gap-2 btn-hover-lift px-6 py-5 text-base">
              <SwooshIcon className="w-5 h-5" />
              See Sample Report for Nike
            </Button>
          </Link>
          <p className="text-xs text-slate-400 mt-3">
            Preview a complete brand analysis instantly
          </p>
        </div>

        {/* How It Works Section */}
        <div
          ref={howItWorksRef}
          className="mt-20 scroll-animate"
        >
          <h2 className="text-2xl font-semibold text-slate-800 text-center mb-12">
            How It Works
          </h2>

          <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-4">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                <Globe className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Enter URL</h3>
              <p className="text-sm text-slate-500 max-w-[180px]">
                Paste any website URL
              </p>
            </div>

            {/* Connector */}
            <div className="hidden md:flex items-center justify-center w-12">
              <div className="w-full h-px bg-gradient-to-r from-indigo-200 to-purple-200 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-purple-300 transform rotate-45" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center mb-4">
                <ScanSearch className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">We Analyze</h3>
              <p className="text-sm text-slate-500 max-w-[180px]">
                AI extracts colors, fonts, logos, and brand voice
              </p>
            </div>

            {/* Connector */}
            <div className="hidden md:flex items-center justify-center w-12">
              <div className="w-full h-px bg-gradient-to-r from-purple-200 to-indigo-200 relative">
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-indigo-300 transform rotate-45" />
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center flex-1">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                <FileDown className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Download PDF</h3>
              <p className="text-sm text-slate-500 max-w-[180px]">
                Get a professional brand guideline in seconds
              </p>
            </div>
          </div>
        </div>

        {/* Feature Tags */}
        <div className="mt-20 text-center">
          <p className="text-sm text-slate-500 mb-6 animate-fade-in-up-delay-3">
            Analysis typically takes 1-3 minutes
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-xs text-slate-500 border border-slate-100 animate-stagger-1">Typography</span>
            <span className="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-xs text-slate-500 border border-slate-100 animate-stagger-2">Colors</span>
            <span className="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-xs text-slate-500 border border-slate-100 animate-stagger-3">Tone & Voice</span>
            <span className="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-xs text-slate-500 border border-slate-100 animate-stagger-4">SEO</span>
            <span className="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-xs text-slate-500 border border-slate-100 animate-stagger-5">Social Links</span>
            <span className="px-3 py-1.5 bg-white/60 backdrop-blur-sm rounded-full text-xs text-slate-500 border border-slate-100 animate-stagger-6">PDF Export</span>
          </div>
        </div>
      </div>
    </div>
  )
}
