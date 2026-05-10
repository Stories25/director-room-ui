'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ScriptDocumentView from '@/components/ScriptDocument'
import { ScriptDocument } from '@/lib/types'

type PageState = 'review' | 'sending' | 'sent' | 'error'

export default function ScriptPage() {
  const router = useRouter()
  const [script, setScript] = useState<ScriptDocument | null>(null)
  const [pageState, setPageState] = useState<PageState>('review')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('directors-room-script')
    if (!stored) { router.push('/'); return }
    try { setScript(JSON.parse(stored)) } catch { router.push('/') }
  }, [router])

  const handleSend = async () => {
    if (!script) return
    setPageState('sending')
    try {
      const res = await fetch('/api/submit-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed to submit') }
      setPageState('sent')
    } catch (err) {
      setError(String(err))
      setPageState('error')
    }
  }

  if (pageState === 'sent') {
    return (
      <main className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-[#080808]">
        <p className="text-xs tracking-[0.3em] uppercase breathe" style={{ color: '#888' }}>
          Your teaser is being built
        </p>
        <p className="text-xs" style={{ color: '#333' }}>
          The production pipeline has your script.
        </p>
      </main>
    )
  }

  if (pageState === 'sending') {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-[#080808]">
        <p className="text-xs tracking-[0.3em] uppercase breathe" style={{ color: '#888' }}>
          Sending to production...
        </p>
      </main>
    )
  }

  if (!script) return null

  return (
    <main
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#080808]"
    >
      {/* Full-width border lines, centered content inside */}

      {/* ── Top bar ── */}
      <div className="flex-none w-full border-b" style={{ borderColor: '#1a1a1a' }}>
        <div
          className="flex items-center justify-between py-4 px-0"
          style={{ width: '720px', margin: '0 auto' }}
        >
          <div className="flex items-center gap-4">
            <p className="text-xs tracking-[0.25em] uppercase" style={{ color: '#444' }}>
              Director&apos;s Room
            </p>
            <span style={{ color: '#222' }}>·</span>
            <p className="text-xs tracking-[0.15em] uppercase" style={{ color: '#555' }}>
              30 Second Teaser
            </p>
          </div>
          <button
            onClick={() => router.push('/room')}
            className="text-xs tracking-widest uppercase px-4 py-2 border transition-all duration-200"
            style={{ borderColor: '#2a2a2a', color: '#666', borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#666' }}
          >
            ← Back to Room
          </button>
        </div>
      </div>

      {/* ── Scrollable document ── */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: '720px', margin: '0 auto', padding: '40px 0 120px 0' }}>

          {pageState === 'error' && (
            <div
              className="mb-8 rounded border px-4 py-3 text-xs"
              style={{ borderColor: '#3a1a1a', background: '#1a0a0a', color: '#cc6666' }}
            >
              {error}
            </div>
          )}

          <ScriptDocumentView script={script} onChange={setScript} />
        </div>
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex-none w-full border-t" style={{ borderColor: '#1a1a1a', background: '#0a0a0a' }}>
        <div
          className="flex items-center justify-between py-5"
          style={{ width: '720px', margin: '0 auto' }}
        >
          <p className="text-xs" style={{ color: '#333' }}>
            All fields are editable before sending.
          </p>
          <button
            onClick={handleSend}
            disabled={['sending', 'sent'].includes(pageState)}
            className="px-8 py-3 text-sm font-medium tracking-widest uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#e8e8e8', color: '#080808', borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#ffffff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#e8e8e8' }}
          >
            Send to Production →
          </button>
        </div>
      </div>
    </main>
  )
}
