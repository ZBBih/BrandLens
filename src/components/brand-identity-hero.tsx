'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ColorData, TypographyData, ToneData, BrandSummary } from '@/lib/extractors/types'

interface BrandIdentityHeroProps {
  brandName: string
  summary: BrandSummary
  colors: ColorData
  typography: TypographyData
  tone: ToneData
  primaryColor: string
}

function CopyableColor({ hex, role }: { hex: string; role: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(hex)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="text-center">
      <button
        onClick={handleCopy}
        className="w-16 h-16 rounded-xl shadow-lg cursor-pointer hover:scale-105 transition-transform relative group"
        style={{ backgroundColor: hex }}
        title={`Click to copy ${hex}`}
      >
        {copied && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl text-white text-xs font-medium">
            Copied!
          </span>
        )}
      </button>
      <p className="text-xs text-slate-500 mt-2 font-mono">{hex.toUpperCase()}</p>
      <p className="text-xs text-slate-400 capitalize">{role}</p>
    </div>
  )
}

export function BrandIdentityHero({
  brandName,
  summary,
  colors,
  typography,
  tone,
  primaryColor,
}: BrandIdentityHeroProps) {
  const [colorsCopied, setColorsCopied] = useState(false)

  const headingFont = typography.fonts.find(f => f.role === 'heading')
  const bodyFont = typography.fonts.find(f => f.role === 'primary') || typography.fonts[0]
  const googleFontsUrl = headingFont?.googleFontsUrl || bodyFont?.googleFontsUrl

  const copyAllColors = async () => {
    const colorText = colors.colors
      .slice(0, 5)
      .map(c => `${c.role}: ${c.hex}`)
      .join('\n')
    await navigator.clipboard.writeText(colorText)
    setColorsCopied(true)
    setTimeout(() => setColorsCopied(false), 1500)
  }

  const openGoogleFonts = () => {
    if (googleFontsUrl) {
      window.open(googleFontsUrl, '_blank')
    } else {
      const fonts = typography.fonts.map(f => f.name).join('|')
      window.open(`https://fonts.google.com/?query=${encodeURIComponent(fonts)}`, '_blank')
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-lg p-8 mb-6">
      {/* Brand Name & Description */}
      <div className="text-center mb-8">
        <h2
          className="text-4xl font-bold mb-3"
          style={{ color: primaryColor }}
        >
          {brandName}
        </h2>
        <p className="text-slate-600 max-w-2xl mx-auto leading-relaxed">
          {summary.description?.slice(0, 200)}
          {summary.description && summary.description.length > 200 ? '...' : ''}
        </p>
      </div>

      {/* Three Columns: Colors | Fonts | Tone */}
      <div className="grid md:grid-cols-3 gap-8 mb-8">
        {/* Colors */}
        <div className="text-center">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
            Colors
          </h3>
          <div className="flex justify-center gap-3 mb-3 flex-wrap">
            {colors.colors.slice(0, 4).map((color) => (
              <CopyableColor key={color.hex} hex={color.hex} role={color.role} />
            ))}
          </div>
          <p className="text-xs text-slate-400">Click to copy hex</p>
        </div>

        {/* Fonts */}
        <div className="text-center">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
            Typography
          </h3>
          {headingFont && (
            <div className="mb-3">
              <p
                className="text-3xl font-bold mb-1"
                style={{ fontFamily: `"${headingFont.name}", sans-serif` }}
              >
                {headingFont.name}
              </p>
              <p className="text-sm text-slate-500">Headings</p>
            </div>
          )}
          {bodyFont && bodyFont.name !== headingFont?.name && (
            <div>
              <p
                className="text-xl mt-3"
                style={{ fontFamily: `"${bodyFont.name}", sans-serif` }}
              >
                {bodyFont.name}
              </p>
              <p className="text-sm text-slate-500">Body</p>
            </div>
          )}
          {typography.fonts.length === 0 && (
            <p className="text-slate-400">System fonts detected</p>
          )}
          {typography.nonInspectableTextWarning && (
            <p className="text-xs text-amber-600 mt-2 italic">
              {typography.nonInspectableTextWarning}
            </p>
          )}
        </div>

        {/* Tone */}
        <div className="text-center">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-4">
            Voice
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {tone.traits.slice(0, 4).map((trait) => (
              <span
                key={trait}
                className="px-3 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                }}
              >
                {trait}
              </span>
            ))}
          </div>
          {tone.traits.length === 0 && (
            <p className="text-slate-400">Analyzing tone...</p>
          )}
        </div>
      </div>

      {/* Quick Export Row */}
      <div className="flex justify-center gap-3 pt-6 border-t flex-wrap">
        <Button variant="outline" size="sm" onClick={copyAllColors}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {colorsCopied ? 'Copied!' : 'Copy Colors'}
        </Button>
        {typography.googleFontsDetected && (
          <Button variant="outline" size="sm" onClick={openGoogleFonts}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Google Fonts
          </Button>
        )}
      </div>
    </section>
  )
}
