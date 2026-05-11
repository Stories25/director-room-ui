'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import ScriptDocumentView from '@/components/ScriptDocument'
import { ScriptDocument } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import { buildPrompt, createProject } from '@/lib/argon-browser'
import { pipelineState } from '@/lib/pipeline-state'
import Button from '@/components/ui/Button'
import WorkflowStepper from '@/components/WorkflowStepper'

type PageState = 'formatting' | 'review' | 'error'

function readSessionScript(): ScriptDocument | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-script')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

interface TranscriptData {
  sessionId: string
  avatarId: string
  transcript: Array<{ speaker: string; text: string; timestamp: number }>
}

function readTranscriptData(): TranscriptData | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-transcript')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

export default function ScriptPage() {
  const router = useRouter()
  const preformattedScript = useMemo(() => readSessionScript(), [])
  const transcriptData = useMemo(() => readTranscriptData(), [])
  const [script, setScript] = useState<ScriptDocument | null>(preformattedScript)
  const [pageState, setPageState] = useState<PageState>(
    preformattedScript ? 'review' : transcriptData ? 'formatting' : 'formatting'
  )
  const [error, setError] = useState<string | null>(null)
  const [formatElapsed, setFormatElapsed] = useState(0)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (script?.title) {
      document.title = `${script.title} | Script`
    } else {
      document.title = "Script | Director's Room"
    }
  }, [script?.title])

  // ── Format script from transcript if no pre-formatted script exists ──
  useEffect(() => {
    if (preformattedScript) return
    if (!transcriptData) {
      // No transcript either — redirect home
      router.push('/')
      return
    }

    let cancelled = false
    const timer = setInterval(() => setFormatElapsed(s => s + 1), 1000)

    async function formatScript() {
      if (!transcriptData) return
      const transcriptFallback = transcriptData.transcript
        .map(e => `${e.speaker === 'HANK' ? 'HANK' : 'DIRECTOR'}: ${e.text}`)
        .join('\n')

      try {
        const res = await fetch('/api/format-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: transcriptData.sessionId,
            avatarId: transcriptData.avatarId,
            transcriptFallback,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to format script')
        }
        const { script: formattedScript } = await res.json()
        if (cancelled) return

        sessionStorage.setItem('directors-room-script', JSON.stringify(formattedScript))
        sessionStorage.removeItem('directors-room-transcript')
        setScript(formattedScript)
        setPageState('review')
      } catch (err) {
        if (cancelled) return
        console.error('[script] Formatting failed:', err)
        setError(String(err))
        setPageState('error')
      } finally {
        clearInterval(timer)
      }
    }

    formatScript()
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [preformattedScript, transcriptData, router])

  const handleRetryFormat = useCallback(() => {
    setError(null)
    setPageState('formatting')
    setFormatElapsed(0)
    // Re-trigger by removing the cached script and reloading
    sessionStorage.removeItem('directors-room-script')
    window.location.reload()
  }, [])

  const handleSend = async () => {
    if (!script) return
    setError(null)
    setIsCreating(true)
    try {
      const prompt = buildPrompt(script)
      const projectId = await createProject(script.title || "Director's Room Teaser", prompt)
      pipelineState.write({ projectId, script, step: 'script', startedAt: Date.now() })
      router.push(`/storyboard/${projectId}?building=1`)
    } catch (err) {
      console.error('[script] Step 1 failed:', err)
      setError(String(err))
      setIsCreating(false)
    }
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Script', current: true },
        ]}
      />

      <WorkflowStepper current="script" />

      {/* ── Formatting state — cinematic loading ── */}
      {pageState === 'formatting' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ opacity: 0.025,
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat', backgroundSize: '128px 128px',
            }}
          />
          <div className="h-8 w-8 rounded-full border-t animate-spin"
            style={{ borderColor: 'var(--surface-2)', borderTopColor: 'var(--accent-amber)' }} />
          <div className="text-center space-y-3">
            <p className="text-sm font-light tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              Crafting your script...
            </p>
            <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
              {formatElapsed < 5 ? 'Reading your conversation with Hank' : `~${Math.max(0, 15 - formatElapsed)}s remaining`}
            </p>
          </div>
        </div>
      )}

      {/* ── Review state — script document ── */}
      {pageState === 'review' && script && (
        <>
          {/* Scrollable document */}
          <div className="flex-1 overflow-y-auto w-full">
            <div style={{ width: 720, margin: '0 auto', padding: '40px 0 120px 0' }}>

              {error && (
                <div className="mb-8 rounded border px-4 py-3 space-y-2"
                  style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
                  <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
                  <Button variant="tertiary" size="sm" onClick={handleSend}>
                    Retry <ArrowRight className="w-3 h-3 inline-block" />
                  </Button>
                </div>
              )}

              <div className="fade-up">
                <ScriptDocumentView script={script} onChange={setScript} />
              </div>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
            <div className="flex items-center justify-between py-5" style={{ width: 720, margin: '0 auto' }}>
              <Button variant="secondary" size="sm" onClick={() => router.push('/room')}>
                <ArrowLeft className="w-3 h-3" /> Story
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleSend}
                disabled={isCreating}
                className="group gap-3"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Creating project
                  </>
                ) : (
                  <span className="flex items-center gap-2">
                    Build Storyboard <ArrowRight className="w-3 h-3 inline-block transition-transform duration-200 group-hover:translate-x-1" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── Error state (formatting failed) ── */}
      {pageState === 'error' && !script && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <p className="text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--text-secondary)' }}>
            Something went wrong
          </p>
          <p className="text-sm font-light max-w-sm text-center" style={{ color: 'var(--text-muted)' }}>
            {error}
          </p>
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" onClick={() => router.push('/room')}>
              <ArrowLeft className="w-3 h-3" /> Back to Room
            </Button>
            <Button variant="primary" size="sm" onClick={handleRetryFormat}>
              Try Again
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
