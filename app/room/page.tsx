'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Check, ArrowRight } from 'lucide-react'
import TranscriptPanel from '@/components/TranscriptPanel'
import StoryPanel, { StoryExtraction } from '@/components/StoryPanel'
import WaveformIndicator from '@/components/WaveformIndicator'
import SessionTimer from '@/components/SessionTimer'
import ConfirmEndModal from '@/components/ConfirmEndModal'
import { SessionCredentials, TranscriptEntry } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import Button from '@/components/ui/Button'
import WorkflowStepper from '@/components/WorkflowStepper'

const AvatarView = dynamic(() => import('@/components/AvatarView'), { ssr: false })

type PageState = 'loading' | 'connected' | 'confirming' | 'finishing' | 'error'
type RightTab = 'transcript' | 'story'

const AVATAR_ID = process.env.NEXT_PUBLIC_AVATAR_ID!

const LOADING_STEPS = [
  { label: 'Setting the stage',         minElapsed: 0  },
  { label: 'Hank is reading your brief',minElapsed: 8  },
  { label: 'Opening the writers room',  minElapsed: 20 },
  { label: 'Establishing the link',     minElapsed: 45 },
  { label: 'Almost in the room',        minElapsed: 65 },
]

const HANK_OPENING = `Alright. You have my attention — and about five minutes before you lose it. Tell me: what is the one image you want burned into someone\u2019s brain. Thirty seconds. Go.`

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

  const [typedQuote, setTypedQuote] = useState('')
  const loadStartRef = useRef<number>(Date.now())

  const [extraction, setExtraction] = useState<StoryExtraction>({
    character: null, setting: null, tone: null, action: null, arc: null,
  })
  const [isExtracting, setIsExtracting] = useState(false)
  const extractionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHankEntryCount = useRef(0)

  useEffect(() => {
    document.title = "Story | Director's Room"
  }, [])

  // Typewriter effect — starts at 55s wall-clock elapsed
  useEffect(() => {
    if (elapsed < 55 || pageState !== 'loading') return
    if (typedQuote.length >= HANK_OPENING.length) return
    const t = setTimeout(() => {
      setTypedQuote(HANK_OPENING.slice(0, typedQuote.length + 1))
    }, 28)
    return () => clearTimeout(t)
  }, [elapsed, typedQuote, pageState])

  // Elapsed ticker — uses wall clock so StrictMode double-fire can't inflate it
  useEffect(() => {
    if (pageState !== 'loading') return
    loadStartRef.current = Date.now()
    setElapsed(0)
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - loadStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [pageState])

  const currentStep = LOADING_STEPS.filter(s => s.minElapsed <= elapsed).pop()
  const loadingProgress = Math.min((elapsed / 90) * 100, 95)

  useEffect(() => {
    let cancelled = false
    let pollInterval: ReturnType<typeof setInterval> | null = null

    async function createSession() {
      try {
        // Step 1: Create session — returns immediately with sessionId (~2s)
        const res = await fetch('/api/avatar/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarId: AVATAR_ID }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create session')
        }
        const { sessionId } = await res.json()
        if (cancelled) return

        // Step 2: Poll status every 3s until READY
        pollInterval = setInterval(async () => {
          if (cancelled) {
            if (pollInterval) clearInterval(pollInterval)
            return
          }
          try {
            const statusRes = await fetch(`/api/avatar/session/status?id=${sessionId}`)
            if (!statusRes.ok) return // transient error — keep polling
            const data = await statusRes.json()
            if (cancelled) return

            if (data.status === 'ready') {
              if (pollInterval) clearInterval(pollInterval)
              setCredentials(data.credentials)
              setSessionStartedAt(Date.now())
              setPageState('connected')
            } else if (data.status === 'failed') {
              if (pollInterval) clearInterval(pollInterval)
              throw new Error(data.error || 'Session failed to provision')
            }
            // 'provisioning' — keep polling
          } catch (err) {
            if (cancelled) return
            if (pollInterval) clearInterval(pollInterval)
            console.error('[room] Status poll failed:', err)
            setError(String(err))
            setPageState('error')
          }
        }, 3000)
      } catch (err) {
        if (cancelled) return
        console.error('[room] Session creation failed:', err)
        setError(String(err))
        setPageState('error')
      }
    }

    createSession()
    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
    }
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
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-10"
          style={{
            background: 'var(--canvas)',
            backgroundImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, rgba(170,136,68,0.04) 0%, transparent 70%)',
          }}
        >
          {/* Film grain overlay — same as connected room */}
          <div className="pointer-events-none absolute inset-0" style={{ opacity: 0.025,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat', backgroundSize: '128px 128px',
          }} />

          {/* Step list */}
          <div className="space-y-3 w-64">
            {LOADING_STEPS.map((step, i) => {
              const done = step.minElapsed < elapsed
              const active = currentStep?.label === step.label
              return (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="h-1.5 w-1.5 rounded-full flex-none transition-all duration-500"
                    style={{ background: done ? 'var(--accent-green)' : active ? 'var(--accent-amber)' : 'var(--text-muted)' }}
                  />
                  <p
                    className={`text-xs transition-colors duration-500 ${active ? 'font-display' : 'font-slate'}`}
                    style={{ color: done ? 'var(--text-tertiary)' : active ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                  >
                    {step.label}
                    {done && <Check className="w-3 h-3 inline ml-1.5" style={{ color: 'var(--accent-green)' }} />}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="w-64 h-px overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full transition-all duration-1000"
              style={{ background: 'var(--accent-amber)', opacity: 0.6, width: `${loadingProgress}%` }}
            />
          </div>

          <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
            {elapsed < 10 ? 'This takes about 60–90 seconds' : `~${Math.max(0, 90 - elapsed)}s remaining`}
          </p>

          {/* Hank's opening line — typewriter, appears at 55s */}
          {elapsed >= 55 && (
            <div
              className="absolute bottom-16 left-1/2 fade-up"
              style={{ transform: 'translateX(-50%)', maxWidth: 480, textAlign: 'center' }}
            >
              <p
                className="text-xs font-slate"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.02em', lineHeight: 1.7 }}
              >
                <span style={{ color: 'var(--accent-amber)', opacity: 0.6, marginRight: 8 }}>
                  Hank —
                </span>
                {typedQuote}
                {/* blinking cursor */}
                {typedQuote.length < HANK_OPENING.length && (
                  <span
                    className="breathe"
                    style={{ display: 'inline-block', width: 1, height: '0.9em', background: 'var(--accent-amber)', marginLeft: 2, verticalAlign: 'text-bottom', opacity: 0.7 }}
                  />
                )}
              </p>
            </div>
          )}
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
          <Button variant="primary" size="md" onClick={() => window.location.reload()}>
            Try Again
          </Button>
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
        <div className="flex flex-col h-full w-full overflow-hidden">
          <TopBar
            breadcrumb={[{ label: 'Story', current: true }]}
          />
          <WorkflowStepper current="story" />

          <div className="flex-1 flex overflow-hidden">
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
              <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10 slide-up">
                <div className="px-4 py-2 rounded text-xs"
                  style={{ background: 'rgba(20,15,5,0.9)', border: '1px solid var(--accent-warm)', color: 'var(--accent-warm)' }}>
                  About 1 minute remaining — start wrapping up
                </div>
              </div>
            )}
            {timeWarning === 'critical' && (
              <div className="absolute bottom-24 left-0 right-0 flex justify-center z-10 slide-up">
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

            <Button
              variant="primary"
              size="md"
              onClick={handleFinishClick}
              disabled={pageState !== 'connected'}
              className="group"
            >
              Finish &amp; Generate Script <ArrowRight className="w-3 h-3 inline-block transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Runway attribution */}
      <div className="absolute bottom-16 right-8 text-xs pointer-events-none z-10" style={{ color: 'var(--text-muted)' }}>
        Powered by Runway
      </div>
    </main>
  )
}
