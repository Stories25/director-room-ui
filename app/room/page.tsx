'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import TranscriptPanel from '@/components/TranscriptPanel'
import MicIndicator from '@/components/MicIndicator'
import { SessionCredentials, TranscriptEntry } from '@/lib/types'

const AvatarView = dynamic(() => import('@/components/AvatarView'), { ssr: false })

type PageState = 'loading' | 'connected' | 'finishing' | 'error'

const AVATAR_ID = process.env.NEXT_PUBLIC_AVATAR_ID!

// Rotating messages shown while Runway provisions the session (~60-90s)
const LOADING_MESSAGES = [
  'Preparing your story writer...',
  'Setting the scene...',
  'Hank is almost ready...',
  'Just a moment...',
  'Warming up the room...',
]

export default function RoomPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [credentials, setCredentials] = useState<SessionCredentials | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [micActive, setMicActive] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  // Rotate loading messages every 8s and count elapsed seconds
  useEffect(() => {
    if (pageState !== 'loading') return
    const msgTimer = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.length)
    }, 8000)
    const elapsedTimer = setInterval(() => {
      setElapsed((s) => s + 1)
    }, 1000)
    return () => { clearInterval(msgTimer); clearInterval(elapsedTimer) }
  }, [pageState])

  useEffect(() => {
    async function createSession() {
      try {
        const res = await fetch('/api/avatar/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: AVATAR_ID }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create session')
        }
        const creds: SessionCredentials = await res.json()
        setCredentials(creds)
        setPageState('connected')
      } catch (err) {
        console.error('[room] Session creation failed:', err)
        setError(String(err))
        setPageState('error')
      }
    }
    createSession()
  }, [])

  const handleTranscriptUpdate = useCallback((entry: TranscriptEntry) => {
    setTranscript((prev) => [...prev, entry])
  }, [])

  const handleMicStateChange = useCallback((active: boolean, muted: boolean) => {
    setMicActive(active)
    setMicMuted(muted)
  }, [])

  const handleFinish = useCallback(() => {
    setPageState('finishing')
    window.dispatchEvent(new Event('director-finish'))
  }, [])

  const handleSessionEnded = useCallback(
    async (sessionId: string) => {
      const transcriptFallback = transcript
        .map((e) => `${e.speaker === 'HANK' ? 'HANK' : 'DIRECTOR'}: ${e.text}`)
        .join('\n')
      try {
        const res = await fetch('/api/format-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, avatarId: AVATAR_ID, transcriptFallback }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to format script')
        }
        const { script } = await res.json()
        sessionStorage.setItem('directors-room-script', JSON.stringify(script))
        router.push('/script')
      } catch (err) {
        console.error('[room] Script formatting failed:', err)
        setError(String(err))
        setPageState('error')
      }
    },
    [transcript, router]
  )

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#080808]">

      {/* ── Loading state ── */}
      {pageState === 'loading' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[#080808]">
          {/* Spinner */}
          <div className="relative h-10 w-10">
            <div
              className="absolute inset-0 rounded-full border"
              style={{ borderColor: '#1e1e1e' }}
            />
            <div
              className="absolute inset-0 rounded-full border-t animate-spin"
              style={{ borderColor: '#555', borderTopColor: '#888' }}
            />
          </div>

          {/* Rotating message */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-light tracking-wide" style={{ color: '#888' }}>
              {LOADING_MESSAGES[loadingMsgIdx]}
            </p>
            {elapsed > 10 && (
              <p className="text-xs" style={{ color: '#333' }}>
                This can take up to 90 seconds
              </p>
            )}
          </div>

          {/* Elapsed bar */}
          <div className="w-48 h-px overflow-hidden" style={{ background: '#1a1a1a' }}>
            <div
              className="h-full transition-all duration-1000"
              style={{
                background: '#444',
                width: `${Math.min((elapsed / 90) * 100, 95)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {pageState === 'error' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#080808]">
          <p className="text-xs tracking-[0.2em] uppercase" style={{ color: '#888' }}>
            Something went wrong
          </p>
          <p className="text-sm font-light max-w-sm text-center" style={{ color: '#444' }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-2.5 text-sm font-medium tracking-widest uppercase transition-all duration-200"
            style={{ background: '#e8e8e8', color: '#080808', borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#ffffff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#e8e8e8' }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Finishing overlay ── */}
      {pageState === 'finishing' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#080808]">
          <div
            className="h-8 w-8 rounded-full border-t animate-spin"
            style={{ borderColor: '#1e1e1e', borderTopColor: '#666' }}
          />
          <p className="text-sm font-light tracking-wide" style={{ color: '#888' }}>
            Crafting your script...
          </p>
        </div>
      )}

      {/* ── Main layout ── */}
      {(pageState === 'connected' || pageState === 'finishing') && credentials && (
        <>
          {/* Left: Avatar (65%) */}
          <div className="relative flex-[0_0_65%] h-full overflow-hidden">
            <AvatarView
              credentials={credentials}
              onTranscriptUpdate={handleTranscriptUpdate}
              onMicStateChange={handleMicStateChange}
              onSessionEnded={handleSessionEnded}
            />
          </div>

          {/* Right: Transcript panel (35%) */}
          <div
            className="flex flex-[0_0_35%] flex-col h-full border-l overflow-hidden"
            style={{ borderColor: '#111', background: '#080808' }}
          >
            <div className="flex-1 overflow-hidden">
              <TranscriptPanel entries={transcript} />
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t px-8 py-4"
            style={{ borderColor: '#1a1a1a', background: 'rgba(8,8,8,0.97)' }}
          >
            <MicIndicator isActive={micActive} isMuted={micMuted} />

            <button
              onClick={handleFinish}
              disabled={pageState === 'finishing'}
              className="px-7 py-2.5 text-sm font-medium tracking-widest uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#e8e8e8', color: '#080808', borderRadius: 4 }}
              onMouseEnter={(e) => {
                if (pageState !== 'finishing') e.currentTarget.style.background = '#ffffff'
              }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#e8e8e8' }}
            >
              Finish &amp; Generate Script
            </button>
          </div>
        </>
      )}

      {/* Runway attribution */}
      <div
        className="absolute bottom-16 right-8 text-xs pointer-events-none"
        style={{ color: '#1e1e1e' }}
      >
        Powered by Runway
      </div>
    </main>
  )
}
