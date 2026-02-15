'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  reportId: string
  slug: string
  brandName: string
  isPublic: boolean
  onTogglePublic: (isPublic: boolean) => Promise<void>
}

export function ShareModal({
  isOpen,
  onClose,
  reportId,
  slug,
  brandName,
  isPublic,
  onTogglePublic,
}: ShareModalProps) {
  const [copying, setCopying] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [localIsPublic, setLocalIsPublic] = useState(isPublic)

  if (!isOpen) return null

  const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/report/${slug}`

  const handleCopyLink = async () => {
    setCopying(true)
    await navigator.clipboard.writeText(publicUrl)
    setTimeout(() => setCopying(false), 2000)
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      await onTogglePublic(!localIsPublic)
      setLocalIsPublic(!localIsPublic)
    } catch (error) {
      console.error('Failed to toggle public status:', error)
    }
    setToggling(false)
  }

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(publicUrl)}`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${brandName}'s brand analysis!`)}&url=${encodeURIComponent(publicUrl)}`
  const emailSubject = encodeURIComponent(`${brandName} Brand Report`)
  const emailBody = encodeURIComponent(`Check out this brand analysis for ${brandName}:\n\n${publicUrl}`)
  const mailtoUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-slate-800">Share Your Brand Report</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Public Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-800">Make this report public</p>
              <p className="text-sm text-slate-500">Anyone with the link can view</p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                localIsPublic ? 'bg-green-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  localIsPublic ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Share URL */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Share Link
            </label>
            <div className="flex gap-2">
              <div
                className={`flex-1 px-4 py-2 border rounded-lg text-sm truncate ${
                  localIsPublic ? 'bg-white text-slate-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {localIsPublic ? publicUrl : 'Enable public sharing to get link'}
              </div>
              <Button
                onClick={handleCopyLink}
                disabled={!localIsPublic}
                variant="outline"
                className="shrink-0"
              >
                {copying ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </Button>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-3">
              Share on Social
            </label>
            <div className="flex gap-3">
              <a
                href={localIsPublic ? linkedInUrl : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => !localIsPublic && e.preventDefault()}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-colors ${
                  localIsPublic
                    ? 'bg-[#0A66C2] text-white hover:bg-[#004182]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </a>
              <a
                href={localIsPublic ? twitterUrl : '#'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => !localIsPublic && e.preventDefault()}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-colors ${
                  localIsPublic
                    ? 'bg-black text-white hover:bg-slate-800'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Twitter
              </a>
              <a
                href={localIsPublic ? mailtoUrl : '#'}
                onClick={(e) => !localIsPublic && e.preventDefault()}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-colors ${
                  localIsPublic
                    ? 'bg-slate-700 text-white hover:bg-slate-600'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Email
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-slate-50 rounded-b-2xl">
          <Button onClick={onClose} variant="outline" className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
