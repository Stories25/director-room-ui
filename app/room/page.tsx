'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import TranscriptPanel from '@/components/TranscriptPanel'
import StoryPanel, { StoryExtraction } from '@/components/StoryPanel'
import WaveformIndicator from '@/components/WaveformIndicator'
import SessionTimer from '@/components/SessionTimer'
import ConfirmEndModal from '@/components/ConfirmEndModal'
import { SessionCredentials, TranscriptEntry } from '@/lib/types'
import { Sprocket } from '@/components/shell/Shell'

const AvatarView = dynamic(() => import('@/components/AvatarView'), { ssr: false })

type PageState = 'loading' | 'connected' | 'confirming' | 'finishing' | 'error'
type RightTab = 'transcript' | 'story'

const AVATAR_ID = process.env.NEXT_PUBLIC_AVATAR_ID!

const LOADING_STEPS = [
  { label: 'Creating session',       minElapsed: 0  },
  { label: 'Provisioning avatar',    minElapsed: 8  },
  { label: 'Loading personality',    minElapsed: 20 },
  { label: 'Establishing video link',minElapsed: 45 },
  { label: 'Almost ready',           minElapsed: 65 },
]

export default function RoomPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [credentials, setCredentials] = useState<SessionCredentials | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [micActive, setMicActive] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [rightTab, setRightTab] = useState<RightTab>('transcript')
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(0)
  const [timeWarning, setTimeWarning] = useState<'none' | 'warning' | 'critical'>('none')

  const [extraction, setExtraction] = useState<StoryExtraction>({
    character: null, setting: null, tone: null, action: null, arc: null,
  })
  const [isExtracting, setIsExtracting] = useState(false)
  const extractionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHankEntryCount = useRef(0)

  useEffect(() => {
    if (pageState !== 'loading') return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pageState])

  const currentStep = LOADING_STEPS.filter(s => s.minElapsed <= elapsed).pop()
  const loadingProgress = Math.min((elapsed / 90) * 100, 95)

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
        setSessionStartedAt(Date.now())
        setPageState('connected')
      } catch (err) {
        console.error('[room] Session creation failed:', err)
        setError(String(err))
        setPageState('error')
      }
    }
    createSession()
  }, [])

  useEffect(() => {
    const hankEntries = transcript.filter(e => e.speaker === 'HANK')
    if (hankEntries.length === lastHankEntryCount.current) return
    lastHankEntryCount.current = hankEntries.length

    if (extractionDebounceRef.current) clearTimeout(extractionDebounceRef.current)
    extractionDebounceRef.current = setTimeout(async () => {
      if (transcript.length < 2) return
      setIsExtracting(true)
      try {
        const res = await fetch('/api/extract-story', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        })
        if (res.ok) {
          const { extraction: ext } = await res.json()
          setExtraction(ext)
          if (Object.values(ext).some(v => v !== null)) {
            setRightTab('story')
          }
        }
      } finally {
        setIsExtracting(false)
      }
    }, 1500)
  }, [transcript])

  const handleTranscriptUpdate = useCallback((entry: TranscriptEntry) => {
    setTranscript(prev => [...prev, entry])
    if (entry.speaker === 'YOU') setIsSpeaking(false)
  }, [])

  const handleMicStateChange = useCallback((active: boolean, muted: boolean) => {
    setMicActive(active)
    setMicMuted(muted)
  }, [])

  useEffect(() => {
    const onSpeechStart = () => setIsSpeaking(true)
    const onSpeechEnd   = () => setIsSpeaking(false)
    window.addEventListener('director-speech-start', onSpeechStart)
    window.addEventListener('director-speech-end',   onSpeechEnd)
    return () => {
      window.removeEventListener('director-speech-start', onSpeechStart)
      window.removeEventListener('director-speech-end',   onSpeechEnd)
    }
  }, [])

  const handleFinishClick = useCallback(() => {
    setPageState('confirming')
  }, [])

  const handleConfirmEnd = useCallback(() => {
    setPageState('finishing')
    window.dispatchEvent(new Event('director-finish'))
  }, [])

  const handleCancelEnd = useCallback(() => {
    setPageState('connected')
  }, [])

  const handleSessionEnded = useCallback(async (sessionId: string) => {
    const transcriptFallback = transcript
      .map(e => `${e.speaker === 'HANK' ? 'HANK' : 'DIRECTOR'}: ${e.text}`)
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
  }, [transcript, router])

  return (
    <main className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      {/* ── Loading state ── */}
      {pageState === 'loading' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-10" style={{ background: 'var(--canvas)' }}>
          <div className="space-y-3 w-64">
            {LOADING_STEPS.map((step, i) => {
              const done = step.minElapsed < elapsed
              const active = currentStep?.label === step.label
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="h-1.5 w-1.5 rounded-full flex-none transition-all duration-500"
                    style={{ background: done ? 'var(--accent-green)' : active ? 'var(--text-tertiary)' : 'var(--text-muted)' }}
                  />
                  <p
                    className="text-xs transition-colors duration-500 font-slate"
                    style={{ color: done ? 'var(--text-tertiary)' : active ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                  >
                    {step.label}
                    {done && <span style={{ color: 'var(--accent-green)' }}> ✓</span>}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="w-64 h-px overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full transition-all duration-1000"
              style={{ background: 'var(--text-tertiary)', width: `${loadingProgress}%` }}
            />
          </div>

          <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
            {elapsed < 10 ? 'This takes about 60–90 seconds' : `~${Math.max(0, 90 - elapsed)}s remaining`}
          </p>
        </div>
      )}

      {/* ── Error state ── */}
      {pageState === 'error' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6" style={{ background: 'var(--canvas)' }}>
          <p className="text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--text-secondary)' }}>
            Something went wrong
          </p>
          <p className="text-sm font-light max-w-sm text-center" style={{ color: 'var(--text-muted)' }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-2.5 text-sm font-medium tracking-[0.2em] uppercase"
            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)', borderRadius: 2 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--text-primary)' }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Finishing overlay ── */}
      {pageState === 'finishing' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4" style={{ background: 'var(--canvas)' }}>
          <div className="h-8 w-8 rounded-full border-t animate-spin"
            style={{ borderColor: 'var(--surface-2)', borderTopColor: 'var(--text-secondary)' }} />
          <p className="text-sm font-light tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            Crafting your script...
          </p>
        </div>
      )}

      {/* ── Confirmation modal ── */}
      {pageState === 'confirming' && (
        <ConfirmEndModal
          extraction={extraction}
          onConfirm={handleConfirmEnd}
          onCancel={handleCancelEnd}
        />
      )}

      {/* ── Main layout ── */}
      {(pageState === 'connected' || pageState === 'confirming' || pageState === 'finishing') && credentials && (
        <>
          {/* Left: Avatar (60%) with viewfinder brackets */}
          <div className="relative flex-[0_0_60%] h-full overflow-hidden">
            <AvatarView
              credentials={credentials}
              onTranscriptUpdate={handleTranscriptUpdate}
              onMicStateChange={handleMicStateChange}
              onSessionEnded={handleSessionEnded}
            />

            {/* Viewfinder corner brackets */}
            <div className="absolute inset-4 pointer-events-none z-10">
              <div className="absolute top-0 left-0 w-6 h-px" style={{ background: 'var(--border-standard)' }} />
              <div className="absolute top-0 left-0 w-px h-6" style={{ background: 'var(--border-standard)' }} />
              <div className="absolute top-0 right-0 w-6 h-px" style={{ background: 'var(--border-standard)' }} />
              <div className="absolute top-0 right-0 w-px h-6" style={{ background: 'var(--border-standard)' }} />
              <div className="absolute bottom-0 left-0 w-6 h-px" style={{ background: 'var(--border-standard)' }} />
              <div className="absolute bottom-0 left-0 w-px h-6" style={{ background: 'var(--border-standard)' }} />
              <div className="absolute bottom-0 right-0 w-6 h-px" style={{ background: 'var(--border-standard)' }} />
              <div className="absolute bottom-0 right-0 w-px h-6" style={{ background: 'var(--border-standard)' }} />
            </div>

            {/* Session timer */}
            {sessionStartedAt > 0 && (
              <div className="absolute top-5 right-5 z-10">
                <SessionTimer
                  startedAt={sessionStartedAt}
                  maxSeconds={300}
                  onWarning={() => setTimeWarning('warning')}
                  onCritical={() => setTimeWarning('critical')}
                />
              </div>
            )}

            {/* Time warning banners */}
            {timeWarning === 'warning' && (
              <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10">
                <div className="px-4 py-2 rounded text-xs"
                  style={{ background: 'rgba(20,15,5,0.9)', border: '1px solid var(--accent-warm)', color: 'var(--accent-warm)' }}>
                  About 1 minute remaining — start wrapping up
                </div>
              </div>
            )}
            {timeWarning === 'critical' && (
              <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10">
                <div className="px-4 py-2 rounded text-xs timer-flash"
                  style={{ background: 'rgba(20,5,5,0.9)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}>
                  30 seconds remaining — finish soon
                </div>
              </div>
            )}
          </div>

          {/* Right: Tabbed panel (40%) */}
          <div
            className="flex flex-[0_0_40%] flex-col h-full border-l overflow-hidden"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--canvas)' }}
          >
            {/* Tab bar */}
            <div className="flex-none flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              {(['transcript', 'story'] as RightTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className="flex-1 py-3.5 text-xs tracking-[0.2em] uppercase transition-colors duration-150 relative"
                  style={{ color: rightTab === tab ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                >
                  {tab === 'story' ? 'Story So Far' : 'Transcript'}
                  {rightTab === tab && (
                    <div className="absolute bottom-0 left-4 right-4 h-px" style={{ background: 'var(--accent-amber)' }} />
                  )}
                  {tab === 'story' && rightTab !== 'story' && Object.values(extraction).some(v => v !== null) && (
                    <span
                      className="absolute top-2.5 right-4 h-1.5 w-1.5 rounded-full"
                      style={{ background: 'var(--accent-green)' }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {rightTab === 'transcript' ? (
                <TranscriptPanel entries={transcript} />
              ) : (
                <StoryPanel extraction={extraction} isExtracting={isExtracting} />
              )}
            </div>
          </div>

          {/* Bottom bar — clapperboard style */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t px-8 py-4"
            style={{ borderColor: 'var(--border-subtle)', background: 'rgba(8,8,8,0.97)' }}
          >
            <WaveformIndicator
              isActive={micActive}
              isMuted={micMuted}
              isSpeaking={isSpeaking}
            />

            <button
              onClick={handleFinishClick}
              disabled={pageState !== 'connected'}
              className="px-7 py-2.5 text-sm font-medium tracking-[0.2em] uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)', borderRadius: 2 }}
              onMouseEnter={e => { if (pageState === 'connected') e.currentTarget.style.background = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--text-primary)' }}
            >
              Finish &amp; Generate Script
            </button>
          </div>
        </>
      )}

      {/* Runway attribution */}
      <div className="absolute bottom-16 right-8 text-xs pointer-events-none z-10" style={{ color: 'var(--text-muted)' }}>
        Powered by Runway
      </div>
    </main>
  )
}
