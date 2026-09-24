import { Check, X } from 'lucide-react'
import type { ToneData } from '@/lib/extractors/types'
import { ensureContrast } from '@/lib/color-contrast'
import { Eyebrow, Section, SectionSkeleton } from './section'

export function VoiceSection({ tone, primary, pending }: { tone: ToneData; primary: string; pending: boolean }) {
  const traitText = ensureContrast(primary, '#f8fafc')
  const empty = tone.traits.length === 0 && tone.doList.length === 0 && tone.dontList.length === 0

  return (
    <Section id="voice" title="Voice & Tone" className="mb-6">
      {pending ? (
        <SectionSkeleton label="The voice and tone analysis" />
      ) : empty ? (
        <p className="text-slate-700">There wasn&apos;t enough readable copy on the site to analyze its voice.</p>
      ) : (
        <>
          <div className="grid gap-8 md:grid-cols-3 [&>*]:min-w-0">
            <div>
              <Eyebrow>Traits</Eyebrow>
              <ul className="flex flex-wrap gap-2">
                {tone.traits.slice(0, 7).map(trait => (
                  <li key={trait} className="rounded-full border bg-slate-50 px-4 py-2 text-sm font-semibold" style={{ color: traitText, borderColor: `${traitText}40` }}>
                    {trait}
                  </li>
                ))}
              </ul>
            </div>

            {tone.doList.length > 0 && (
              <div>
                <Eyebrow className="text-emerald-800">Do</Eyebrow>
                <ul className="space-y-2">
                  {tone.doList.slice(0, 5).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tone.dontList.length > 0 && (
              <div>
                <Eyebrow className="text-red-800">Don&apos;t</Eyebrow>
                <ul className="space-y-2">
                  {tone.dontList.slice(0, 5).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                      <X className="mt-0.5 size-4 shrink-0 text-red-700" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {(tone.sampleHeadlines.length > 0 || tone.sampleCtas.length > 0) && (
            <div className="mt-8 grid gap-8 border-t pt-8 md:grid-cols-2">
              {tone.sampleHeadlines.length > 0 && (
                <div>
                  <Eyebrow>Headlines in this voice</Eyebrow>
                  <ul className="space-y-2">
                    {tone.sampleHeadlines.map((headline, i) => (
                      <li key={i} className="text-slate-900">
                        &ldquo;{headline}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tone.styleNotes.length > 0 && (
                <div>
                  <Eyebrow>Style notes</Eyebrow>
                  <ul className="list-disc space-y-2 pl-5 text-sm text-slate-800">
                    {tone.styleNotes.map((note, i) => (
                      <li key={i}>{note}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  )
}
