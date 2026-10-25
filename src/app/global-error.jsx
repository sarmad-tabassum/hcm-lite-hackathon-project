'use client'
import { useEffect } from 'react'
import { RefreshCcw } from 'lucide-react'

/**
 * Root crash guard — last resort when even the root layout throws.
 * Kept dependency-free (no UI kit) because global-error must render even
 * when the rest of the app is broken.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error('[global error boundary]', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', margin: 0 }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 32, boxShadow: '0 10px 30px rgba(2,6,23,.06)' }}>
            <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 16, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#dc2626', fontWeight: 700 }}>!</div>
            <h1 style={{ fontSize: 18, margin: '0 0 8px', color: '#0f172a' }}>The app hit a critical error</h1>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>
              Reload the page to continue. If this keeps happening, sign in again from the login portal.
            </p>
            <button
              onClick={reset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#059669', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
            >
              Reload the app
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
