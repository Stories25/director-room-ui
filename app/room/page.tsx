'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Check, ArrowRight } from 'lucide-react'
import { StoryExtraction } from '@/components/StoryPanel'
import SessionTimer from '@/components/SessionTimer'
import ConfirmEndModal from '@/components/ConfirmEndModal'
import { SessionCredentials, TranscriptEntry } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import Button from '@/components/ui/Button'
import WorkflowStepper from '@/components/WorkflowStepper'

const AvatarView = dynamic(() => import('@/components/AvatarView'), { ssr: false })

type PageState = 'loading' | 'connected' | 'confirming' | 'finishing' | 'error'

const AVATAR_ID = process.env.NEXT_PUBLIC_AVATAR_ID!

const LOADING_STEPS = [
  { label: 'Setting the stage',         minElapsed: 0  },
  { label: 'Hank is reading your brief',minElapsed: 8  },
  { label: 'Opening the writers room',  minElapsed: 20 },
  { label: 'Establishing the link',     minElapsed: 45 },
  { label: 'Almost in the room',        minElapsed: 65 },
]

const FILMMAKING_FACTS = [
  'The first film ever made was just 2.11 seconds long — it was called "Roundhay Garden Scene" (1888).',
  'Alfred Hitchcock made cameo appearances in 39 of his 52 major films.',
  'The shower scene in Psycho took 7 days to shoot and used 70 different camera angles.',
  'The "Wilhelm Scream" has been used in over 400 films since 1951.',
  'The longest film ever made is "Logistics" — it runs for 857 hours (35 days).',
  'Steven Spielberg was rejected from film school three times before getting into USC.',
  'The first movie to show a flushing toilet was Alfred Hitchcock\u2019s Psycho (1960).',
  'Toy Story 2 was almost accidentally deleted when someone ran a bad command at Pixar.',
  'The iconic scream in The Lord of the Rings was actually a recording of a donkey.',
  'The phrase "lights, camera, action" was first used by director D.W. Griffith in the 1920s.',
]

const FACT_DURATION_MS = 6000 // each fact visible for 6s

export default function RoomPage() {
  const router = useRouter()
  const [pageState, setPageState] = useState<PageState>('loading')
  const [credentials, setCredentials] = useState<SessionCredentials | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [micActive, setMicActive] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(0)
  const [timeWarning, setTimeWarning] = useState<'none' | 'warning' | 'critical'>('none')

  const [currentFactIndex, setCurrentFactIndex] = useState(0)

  const [extraction, setExtraction] = useState<StoryExtraction>({
    character: null, setting: null, tone: null, action: null, arc: null,
  })
  const [isExtracting, setIsExtracting] = useState(false)
  const extractionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHankEntryCount = useRef(0)

  // ── Preload AvatarView chunk while session provisions ──
  useEffect(() => {
    import('@/components/AvatarView')
  }, [])

  useEffect(() => {
    document.title = "Story | Director's Room"
  }, [])

  // ── Rotating filmmaking facts — cycle every 6s ──
  useEffect(() => {
    if (pageState !== 'loading') return
    const cycle = setInterval(() => {
      setCurrentFactIndex(prev => (prev + 1) % FILMMAKING_FACTS.length)
    }, FACT_DURATION_MS)
    return () => clearInterval(cycle)
  }, [pageState])

  useEffect(() => {
    if (pageState !== 'loading') return
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [pageState])

  const currentStep = LOADING_STEPS.filter(s => s.minElapsed <= elapsed).pop()
  const loadingProgress = Math.min((elapsed / 90) * 100, 95)

  useEffect(() => {
    let cancelled = false
    let pollInterval: ReturnType<typeof setInterval> | null = null
    let pollCount = 0
    let consecutiveErrors = 0
    let isCreatingFresh = false

    async function createSession() {
      try {
        let sessionId: string | null = null

        // ── Try pre-warmed session from landing page ──
        try {
          const prewarm = sessionStorage.getItem('directors-room-prewarm')
          if (prewarm) {
            const parsed = JSON.parse(prewarm)
            if (parsed.sessionId && parsed.avatarId === AVATAR_ID) {
              sessionId = parsed.sessionId
              console.log('[room] Using pre-warmed session:', sessionId)
            }
            sessionStorage.removeItem('directors-room-prewarm')
          }
        } catch {
          // ignore parse errors
        }

        // ── Fallback: create fresh session ──
        if (!sessionId) {
          const res = await fetch('/api/avatar/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatarId: AVATAR_ID }),
          })
          if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || 'Failed to create session')
          }
          const data = await res.json()
          sessionId = data.sessionId
          if (cancelled) return
        }

        // ── Poll status: 1.5s for first 20 polls, then 3s ──
        const getInterval = () => (pollCount < 20 ? 1500 : 3000)

        const doPoll = async () => {
          if (cancelled || isCreatingFresh) return

          // Hard timeout after ~120s of polling
          if (pollCount > 60) {
            if (pollInterval) clearInterval(pollInterval)
            setError('Session is taking longer than expected. Runway may be experiencing high load. Please try again.')
            setPageState('error')
            return
          }

          try {
            const statusRes = await fetch(`/api/avatar/session/status?id=${sessionId}`)

            // If the session ID is invalid (400/404), abandon it and create fresh
            if (statusRes.status === 400 || statusRes.status === 404) {
              console.warn('[room] Stale/invalid session ID, creating fresh session...')
              if (pollInterval) clearInterval(pollInterval)
              isCreatingFresh = true
              const res = await fetch('/api/avatar/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatarId: AVATAR_ID }),
              })
              if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to create fresh session')
              }
              const data = await res.json()
              sessionId = data.sessionId
              pollCount = 0
              consecutiveErrors = 0
              isCreatingFresh = false
              pollInterval = setInterval(doPoll, getInterval())
              return
            }

            if (!statusRes.ok) {
              consecutiveErrors++
              pollCount++
              // After 5 consecutive errors, treat as fatal
              if (consecutiveErrors > 5) {
                if (pollInterval) clearInterval(pollInterval)
                throw new Error(`Status API failed ${consecutiveErrors} times in a row`)
              }
              return // transient error — keep polling
            }

            consecutiveErrors = 0 // reset on success
            const data = await statusRes.json()
            if (cancelled) return

            if (data.status === 'ready') {
              if (pollInterval) clearInterval(pollInterval)
              setCredentials(data.credentials)
              setPageState('connected')
            } else if (data.status === 'failed') {
              if (pollInterval) clearInterval(pollInterval)
              throw new Error(data.error || 'Session failed to provision')
            }
            // 'provisioning' — keep polling
            pollCount++
            const nextInterval = getInterval()
            if (pollInterval) {
              clearInterval(pollInterval)
              pollInterval = setInterval(doPoll, nextInterval)
            }
          } catch (err) {
            if (cancelled) return
            if (pollInterval) clearInterval(pollInterval)
            console.error('[room] Status poll failed:', err)
            setError(String(err))
            setPageState('error')
          }
        }

        pollInterval = setInterval(doPoll, getInterval())
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
        }
      } finally {
        setIsExtracting(false)
      }
    }, 1500)
  }, [transcript])

  const handleSessionActive = useCallback(() => {
    setSessionStartedAt(Date.now())
  }, [])

  const handleTranscriptUpdate = useCallback((entry: TranscriptEntry) => {
    setTranscript(prev => [...prev, entry])
  }, [])

  const handleMicStateChange = useCallback((active: boolean, muted: boolean) => {
    setMicActive(active)
    setMicMuted(muted)
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

  // ── Is the session still provisioning? ──
  const isProvisioning = pageState === 'loading'

  return (
    <main className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

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

      {/* ════════════════════════════════════════════════════════
         MAIN LAYOUT — always visible, even while provisioning
      ════════════════════════════════════════════════════════ */}
      <div className="flex flex-col h-full w-full overflow-hidden">
        <TopBar
          breadcrumb={[{ label: 'Story', current: true }]}
        />
        <WorkflowStepper current="story" />

        <div className="flex-1 relative overflow-hidden">
          {/* Top right — timer */}
          {!isProvisioning && sessionStartedAt > 0 && (
            <div className="absolute top-4 right-6 z-20">
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
            <div className="absolute top-16 left-0 right-0 flex justify-center z-20 slide-up">
              <div className="px-4 py-2 rounded text-xs"
                style={{ background: 'rgba(255,250,240,0.97)', border: '1px solid var(--accent-warm)', color: 'var(--accent-warm)' }}>
                About 1 minute remaining — start wrapping up
              </div>
            </div>
          )}
          {timeWarning === 'critical' && (
            <div className="absolute top-16 left-0 right-0 flex justify-center z-20 slide-up">
              <div className="px-4 py-2 rounded text-xs timer-flash"
                style={{ background: 'rgba(255,245,245,0.97)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}>
                30 seconds remaining — finish soon
              </div>
            </div>
          )}

          {/* Center: Avatar / Loading */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">

            {/* ── PROVISIONING STATE ── */}
            {isProvisioning && (
              <div className="flex flex-col items-center justify-center gap-8 w-full max-w-md px-8">
                {/* Pulsing rings as avatar placeholder */}
                <div className="relative" style={{ width: 300, height: 300 }}>
                  <div
                    className="absolute inset-0 rounded-full border avatar-ring-outer"
                    style={{ borderColor: 'var(--border-standard)', borderWidth: 1, opacity: 0.3 }}
                  />
                  <div
                    className="absolute rounded-full border avatar-ring-mid"
                    style={{ inset: 20, borderColor: 'var(--border-standard)', borderWidth: 1, opacity: 0.4 }}
                  />
                  <div
                    className="absolute rounded-full border avatar-ring-inner"
                    style={{ inset: 40, borderColor: 'var(--border-emphasis)', borderWidth: 1, opacity: 0.5 }}
                  />
                  {/* Center pulsing dot */}
                  <div className="absolute left-1/2 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full animate-pulse"
                    style={{ background: 'var(--accent-amber)' }} />
                </div>

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

                {/* Rotating filmmaking facts */}
                <div className="flex flex-col items-center justify-center text-center px-6" style={{ maxWidth: 560 }}>
                  <p
                    className="text-[10px] font-slate tracking-[0.2em] uppercase mb-3"
                    style={{ color: 'var(--accent-amber)', opacity: 0.7 }}
                  >
                    Did you know?
                  </p>
                  <p
                    className="text-sm font-light leading-relaxed"
                    style={{ color: 'var(--text-secondary)', minHeight: '3.5em' }}
                  >
                    {FILMMAKING_FACTS[currentFactIndex]}
                  </p>
                </div>
              </div>
            )}

            {/* ── CONNECTED STATE ── */}
            {!isProvisioning && credentials && (
              <div className="flex flex-col items-center gap-6">
                {/* Instructive label above avatar */}
                <div className="text-center max-w-lg">
                  <p
                    className="text-sm font-light leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Hank's in the chair. What's the one image you want burned into someone's brain? Thirty seconds. Go.
                  </p>
                </div>

                <div
                  className="overflow-hidden"
                  style={{
                    width: 720,
                    height: 405,         /* 16:9 — matches the natural Runway feed */
                    border: '1px solid var(--border-standard)',
                    borderRadius: 4,
                    background: 'var(--surface-2)',
                  }}
                >
                  <AvatarView
                    credentials={credentials}
                    onTranscriptUpdate={handleTranscriptUpdate}
                    onMicStateChange={handleMicStateChange}
                    onSessionEnded={handleSessionEnded}
                    onSessionActive={handleSessionActive}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Floating Generate Script button — bottom-right */}
          {!isProvisioning && (
            <div className="absolute bottom-6 right-6 z-20">
              <Button
                variant="primary"
                size="sm"
                onClick={handleFinishClick}
                disabled={pageState !== 'connected'}
                className="group"
              >
                Generate Script <ArrowRight className="w-3 h-3 inline-block transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Runway attribution */}
      <div className="absolute bottom-16 right-8 text-xs pointer-events-none z-10" style={{ color: 'var(--text-muted)' }}>
        Powered by Runway
      </div>
    </main>
  )
}
