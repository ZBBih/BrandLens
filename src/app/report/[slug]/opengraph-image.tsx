import { ImageResponse } from 'next/og'
import { readableTextOn, safeHex } from '@/lib/color-contrast'
import { loadPublicReport } from './data'

export const alt = 'Brand guidelines summary'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const report = await loadPublicReport(slug)

  const brandName = report?.brandName ?? 'Brand report'
  const colors = (report?.colors.colors ?? []).slice(0, 5).map(c => safeHex(c.hex, '#cbd5e1'))
  const primary = colors[0] ?? '#4338ca'
  const ink = readableTextOn(primary)
  const traits = (report?.tone.traits ?? []).slice(0, 3)

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#ffffff' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 64, background: primary, color: ink }}>
          <div style={{ fontSize: 28, opacity: 0.9 }}>{report?.domain ?? ''}</div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{brandName.slice(0, 40)}</div>
          <div style={{ fontSize: 34, marginTop: 8 }}>Brand guidelines</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 64px' }}>
          <div style={{ display: 'flex', gap: 16 }}>
            {colors.map((color, index) => (
              <div key={index} style={{ width: 72, height: 72, borderRadius: 16, background: color, border: '2px solid #e2e8f0' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', color: '#0f172a' }}>
            <div style={{ fontSize: 26 }}>{traits.join(' · ')}</div>
            <div style={{ fontSize: 22, color: '#475569', marginTop: 6 }}>BrandLens</div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
