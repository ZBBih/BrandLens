'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', margin: 0, background: '#f8fafc' }}>
        <main role="alert" style={{ maxWidth: 420, padding: 32, background: '#ffffff', borderRadius: 16, textAlign: 'center', color: '#0f172a' }}>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>BrandLens is having trouble</h1>
          <p style={{ color: '#334155', margin: '0 0 24px' }}>Please try again in a moment.</p>
          <button
            type="button"
            onClick={reset}
            style={{ background: '#4f46e5', color: '#ffffff', border: 0, borderRadius: 8, padding: '10px 20px', fontSize: 16, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
