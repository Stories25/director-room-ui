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

const AvatarView = dynamic(() => import('@/components/AvatarView'), { ssr: false })

type PageState = 'loading' | 'connected' | 'confirming' | 'finishing' | 'error'
type RightTab = 'transcript' | 'story'

const AVATAR_ID = process.env.NEXT_PUBLIC_AVATAR_ID!

// P1: Explicit step-by-step loading messages
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

  // P0: Live story extraction state
  const [extraction, setExtraction] = useState<StoryExtraction>({
    character: null, setting: null, tone: null, action: null, arc: null,
  })
  const [isExtracting, setIsExtracting] = useState(false)
  const extractionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHankEntryCount = useRef(0)

  // P1: Loading progress
  useEffect(() => {
    if (pageState !== 'loading') return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pageState])

  const currentStep = LOADING_STEPS.filter(s => s.minElapsed <= elapsed).pop()
  const loadingProgress = Math.min((elapsed / 90) * 100, 95)

  // Session creation
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

  // P0: Run story extraction after every new HANK entry (debounced 1.5s)
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
          // Auto-switch to story tab when first extraction arrives
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
    // Detect when director is speaking vs not (simple heuristic)
    if (entry.speaker === 'YOU') setIsSpeaking(false)
  }, [])

  const handleMicStateChange = useCallback((active: boolean, muted: boolean) => {
    setMicActive(active)
    setMicMuted(muted)
  }, [])

  // P1: Detect speaking state via mic activity
  // The AvatarView will dispatch a custom event when user speech starts/stops
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

  // P0: Show confirmation modal before ending
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
    <main className="flex h-screen w-screen overflow-hidden bg-[#080808]">

      {/* ── P1: Improved loading state ── */}
      {pageState === 'loading' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-10 bg-[#080808]">
          {/* Steps */}
          <div className="space-y-3 w-64">
            {LOADING_STEPS.map((step, i) => {
              const done = step.minElapsed < elapsed
              const active = currentStep?.label === step.label
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="h-1.5 w-1.5 rounded-full flex-none transition-all duration-500"
                    style={{ background: done ? '#5a8a5a' : active ? '#888' : '#222' }}
                  />
                  <p
                    className="text-xs transition-colors duration-500"
                    style={{ color: done ? '#555' : active ? '#aaa' : '#2a2a2a' }}
                  >
                    {step.label}
                    {done && <span style={{ color: '#4a7a4a' }}> ✓</span>}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="w-64 h-px overflow-hidden" style={{ background: '#1a1a1a' }}>
            <div
              className="h-full transition-all duration-1000"
              style={{ background: '#444', width: `${loadingProgress}%` }}
            />
          </div>

          {/* ETA */}
          <p className="text-xs" style={{ color: '#2a2a2a' }}>
            {elapsed < 10
              ? 'This takes about 60-90 seconds'
              : `~${Math.max(0, 90 - elapsed)}s remaining`}
          </p>
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
            className="px-8 py-2.5 text-sm font-medium tracking-widest uppercase"
            style={{ background: '#e8e8e8', color: '#080808', borderRadius: 4 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#e8e8e8' }}
          >
            Try Again
          </button>
        </div>
      )}

      {/* ── Finishing overlay ── */}
      {pageState === 'finishing' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#080808]">
          <div className="h-8 w-8 rounded-full border-t animate-spin"
            style={{ borderColor: '#1e1e1e', borderTopColor: '#666' }} />
          <p className="text-sm font-light tracking-wide" style={{ color: '#888' }}>
            Crafting your script...
          </p>
        </div>
      )}

      {/* ── P0: Confirmation modal ── */}
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
          {/* Left: Avatar (55%) */}
          <div className="relative flex-[0_0_55%] h-full overflow-hidden">
            <AvatarView
              credentials={credentials}
              onTranscriptUpdate={handleTranscriptUpdate}
              onMicStateChange={handleMicStateChange}
              onSessionEnded={handleSessionEnded}
            />

            {/* P1: Session timer — top right of avatar panel */}
            {sessionStartedAt > 0 && (
              <div className="absolute top-4 right-4 z-10">
                <SessionTimer
                  startedAt={sessionStartedAt}
                  maxSeconds={300}
                  onWarning={() => setTimeWarning('warning')}
                  onCritical={() => setTimeWarning('critical')}
                />
              </div>
            )}

            {/* Time warning banner */}
            {timeWarning === 'warning' && (
              <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10">
                <div className="px-4 py-2 rounded text-xs"
                  style={{ background: 'rgba(20,15,5,0.9)', border: '1px solid #3a2a10', color: '#aa7733' }}>
                  About 1 minute remaining — start wrapping up
                </div>
              </div>
            )}
            {timeWarning === 'critical' && (
              <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10">
                <div className="px-4 py-2 rounded text-xs timer-flash"
                  style={{ background: 'rgba(20,5,5,0.9)', border: '1px solid #4a1515', color: '#cc4444' }}>
                  30 seconds remaining — finish soon
                </div>
              </div>
            )}
          </div>

          {/* Right: Tabbed panel (45%) */}
          <div
            className="flex flex-[0_0_45%] flex-col h-full border-l overflow-hidden"
            style={{ borderColor: '#111', background: '#080808' }}
          >
            {/* Tab bar */}
            <div className="flex-none flex border-b" style={{ borderColor: '#1a1a1a' }}>
              {(['transcript', 'story'] as RightTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className="flex-1 py-3.5 text-xs tracking-[0.2em] uppercase transition-colors duration-150 relative"
                  style={{ color: rightTab === tab ? '#aaa' : '#333' }}
                >
                  {tab === 'story' ? 'Story So Far' : 'Transcript'}
                  {/* Active underline */}
                  {rightTab === tab && (
                    <div className="absolute bottom-0 left-4 right-4 h-px" style={{ background: '#444' }} />
                  )}
                  {/* Badge — unread story updates */}
                  {tab === 'story' && rightTab !== 'story' && Object.values(extraction).some(v => v !== null) && (
                    <span
                      className="absolute top-2.5 right-4 h-1.5 w-1.5 rounded-full"
                      style={{ background: '#5a8a5a' }}
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

          {/* Bottom bar */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t px-8 py-4"
            style={{ borderColor: '#1a1a1a', background: 'rgba(8,8,8,0.97)' }}
          >
            {/* P1: Waveform indicator */}
            <WaveformIndicator
              isActive={micActive}
              isMuted={micMuted}
              isSpeaking={isSpeaking}
            />

            {/* P0: Finish button — triggers confirmation modal */}
            <button
              onClick={handleFinishClick}
              disabled={pageState !== 'connected'}
              className="px-7 py-2.5 text-sm font-medium tracking-widest uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: '#e8e8e8', color: '#080808', borderRadius: 4 }}
              onMouseEnter={e => { if (pageState === 'connected') e.currentTarget.style.background = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#e8e8e8' }}
            >
              Finish &amp; Generate Script
            </button>
          </div>
        </>
      )}

      {/* Runway attribution */}
      <div className="absolute bottom-16 right-8 text-xs pointer-events-none" style={{ color: '#1e1e1e' }}>
        Powered by Runway
      </div>
    </main>
  )
}
