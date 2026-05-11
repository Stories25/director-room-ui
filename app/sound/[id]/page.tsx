'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Play, ArrowRight, ArrowLeft, Loader2, Check,
  Download, AlertCircle, RefreshCw, Music,
} from 'lucide-react'
import type { Bgm, BgmTimestamp, ScriptDocument, VideoResult } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import WorkflowStepper from '@/components/WorkflowStepper'
import Button from '@/components/ui/Button'

// ─── Dynamic note colours ─────────────────────────────────────────────────────

const NOTE_COLORS: Record<string, string> = {
  INTRO: 'rgba(170,136,68,0.35)',
  RISE:  'rgba(170,136,68,0.60)',
  PEAK:  'rgba(170,136,68,1.00)',
  FALL:  'rgba(170,136,68,0.50)',
  FADE:  'rgba(170,136,68,0.25)',
}
const NOTE_COLOR_DEFAULT = 'rgba(170,136,68,0.4)'

// ─── Waveform — client-only (avoids SSR/hydration mismatch on Math.sin) ───────

function generateWaveform(seed: number, bars = 48): number[] {
  const out: number[] = []
  for (let i = 0; i < bars; i++) {
    const x = Math.sin(seed * 9.7 + i * 0.7) * 0.5
      + Math.sin(seed * 3.1 + i * 1.3) * 0.3
      + Math.sin(seed * 17.3 + i * 0.4) * 0.2
    out.push(Math.max(0.08, Math.min(1, (x + 1) / 2)))
  }
  return out
}

function WaveformInner({ seed, animate, height = 48 }: {
  seed: number; animate: boolean; height?: number
}) {
  const bars = generateWaveform(seed)
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className={animate ? 'breathe' : ''}
          style={{
            width: '3px',
            height: `${(h * 100).toFixed(2)}%`,
            background: 'var(--accent-amber)',
            borderRadius: '1px',
            opacity: animate ? 0.75 : 0.4,
            animationDelay: animate ? `${i * 35}ms` : undefined,
            animationDuration: animate ? `${(1.6 + (i % 5) * 0.2).toFixed(1)}s` : undefined,
          }}
        />
      ))}
    </div>
  )
}

const Waveform = dynamic(() => Promise.resolve(WaveformInner), { ssr: false })

// ─── Generating view — client-only ────────────────────────────────────────────

function GeneratingViewInner({ elapsed, label, title }: {
  elapsed: number; label: string; title?: string
}) {
  const estimate = Math.max(0, 60 - elapsed)
  const bars = generateWaveform(42, 56)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10">
      <div className="flex items-end gap-[3px]" style={{ height: 96 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            className="breathe"
            style={{
              width: '4px',
              height: `${(h * 100).toFixed(2)}%`,
              background: 'var(--accent-amber)',
              borderRadius: '2px',
              opacity: 0.6,
              animationDelay: `${i * 45}ms`,
              animationDuration: `${(1.8 + (i % 4) * 0.3).toFixed(1)}s`,
            }}
          />
        ))}
      </div>

      <div className="text-center space-y-3">
        {title && (
          <p className="text-lg font-display font-light" style={{ color: 'var(--text-primary)' }}>
            {title}
          </p>
        )}
        <p className="text-sm font-light breathe" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </p>
        <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
          ElevenLabs is scoring your teaser via Runway
        </p>
      </div>

      <p className="text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {elapsed < 5 ? 'This takes about 60 seconds' : `~${estimate}s remaining`}
      </p>
    </div>
  )
}

const GeneratingView = dynamic(() => Promise.resolve(GeneratingViewInner), { ssr: false })

// ─── Timeline row ─────────────────────────────────────────────────────────────

function TimelineRow({ ts, isLast }: { ts: BgmTimestamp; isLast: boolean }) {
  const duration = ((ts.end_ms - ts.start_ms) / 1000).toFixed(1)
  const fillPct  = ((ts.energy / 5) * 100).toFixed(0)
  const color    = NOTE_COLORS[ts.dynamic_note] ?? NOTE_COLOR_DEFAULT

  return (
    <div
      className="flex items-center gap-4 py-3"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)' }}
    >
      <span
        className="flex-none text-[9px] font-slate px-1.5 py-0.5 rounded border"
        style={{
          width: 36, textAlign: 'center',
          color: 'var(--accent-amber)',
          borderColor: 'rgba(170,136,68,0.25)',
          background: 'rgba(170,136,68,0.05)',
        }}
      >
        {ts.shot_id}
      </span>

      <div className="flex-none rounded-sm overflow-hidden"
        style={{ width: 80, height: 6, background: 'var(--surface-3)' }}>
        <div
          className="h-full rounded-sm"
          style={{
            width: `${fillPct}%`,
            background: color,
            boxShadow: ts.dynamic_note === 'PEAK' ? `0 0 6px ${color}` : 'none',
          }}
        />
      </div>

      <span className="flex-none text-[9px] font-slate tracking-[0.1em] uppercase"
        style={{ color, width: 56 }}>
        {ts.dynamic_note}
      </span>

      <span className="flex-none text-[10px] font-slate tabular-nums"
        style={{ color: 'var(--text-muted)', width: 28 }}>
        {duration}s
      </span>

      <div className="flex items-center gap-1.5 flex-none">
        <div className="rounded-sm overflow-hidden"
          style={{ width: 40, height: 3, background: 'var(--surface-3)' }}>
          <div className="h-full rounded-sm"
            style={{ width: `${(ts.volume * 100).toFixed(0)}%`, background: 'var(--text-tertiary)' }} />
        </div>
        <span className="text-[9px] font-slate tabular-nums"
          style={{ color: 'var(--text-muted)' }}>
          {Math.round(ts.volume * 100)}%
        </span>
      </div>
    </div>
  )
}

// ─── Ready view ───────────────────────────────────────────────────────────────

function ReadyView({
  bgm, video, approved, onApprove, onRegenerate,
}: {
  bgm: Bgm
  video: VideoResult | null
  approved: boolean
  onApprove: () => void
  onRegenerate: () => void
}) {
  const durationSec = (bgm.duration_ms / 1000).toFixed(0)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 40, paddingBottom: 100, paddingLeft: 40, paddingRight: 40 }}>

      <div className="mb-8">
        <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-1.5"
          style={{ color: 'var(--text-muted)' }}>Step 5 of 5</p>
        <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
          Sound Engineering
        </h1>
      </div>

      {/* Video preview */}
      <div className="rounded border overflow-hidden mb-6"
        style={{ borderColor: 'var(--border-standard)', background: 'var(--canvas)' }}>
        <div className="relative w-full" style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}>
          {video?.clips?.[0]?.thumbnailUrl ? (
            <img src={video.clips[0].thumbnailUrl} alt="Preview"
              className="w-full h-full object-cover opacity-50" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-8 h-8" style={{ color: 'var(--border-emphasis)' }} />
            </div>
          )}
          <div className="absolute inset-5 pointer-events-none">
            {['top-0 left-0 border-t border-l','top-0 right-0 border-t border-r',
              'bottom-0 left-0 border-b border-l','bottom-0 right-0 border-b border-r'].map((c, i) => (
              <div key={i} className={`absolute w-5 h-5 ${c}`}
                style={{ borderColor: 'var(--border-emphasis)' }} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)' }}>
              <Play className="w-6 h-6 fill-white text-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Waveform strip */}
        <div className="px-6 py-4 border-t flex items-center gap-4"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
          <div className="flex-1">
            <Waveform seed={1} animate={!approved} height={40} />
          </div>
          <span className="text-[10px] font-slate tabular-nums flex-none"
            style={{ color: 'var(--text-muted)' }}>
            {durationSec}s
          </span>
        </div>
      </div>

      {/* Native audio player */}
      <div className="mb-8 space-y-3">
        <audio controls src={bgm.url} className="w-full"
          style={{ height: 36, colorScheme: 'dark' as React.CSSProperties['colorScheme'] }} />
        <div className="flex items-start gap-2">
          <Music className="w-3 h-3 flex-none mt-0.5"
            style={{ color: 'var(--accent-amber)', opacity: 0.7 }} />
          <p className="text-[11px] font-light leading-relaxed italic"
            style={{ color: 'var(--text-muted)' }}>
            {bgm.prompt}
          </p>
        </div>
      </div>

      {/* Shot timeline */}
      {bgm.timestamps.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <p className="text-[10px] tracking-[0.25em] uppercase font-slate"
              style={{ color: 'var(--text-muted)' }}>
              Soundtrack Timeline
            </p>
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
              {bgm.timestamps.length} shots · {durationSec}s
            </span>
          </div>

          <div className="rounded border overflow-hidden"
            style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}>
            <div className="flex items-center gap-4 px-4 py-2 border-b"
              style={{ borderColor: 'var(--border-subtle)' }}>
              {[{l:'Shot',w:36},{l:'Energy',w:80},{l:'Stage',w:56},{l:'Dur',w:28},{l:'Vol',w:64}].map(col => (
                <span key={col.l}
                  className="text-[9px] tracking-[0.15em] uppercase font-slate flex-none"
                  style={{ color: 'var(--text-muted)', width: col.w }}>
                  {col.l}
                </span>
              ))}
            </div>
            <div className="px-4">
              {bgm.timestamps.map((ts, i) => (
                <TimelineRow
                  key={`${ts.shot_id}-${ts.start_ms}`}
                  ts={ts}
                  isLast={i === bgm.timestamps.length - 1}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <Button variant="secondary" size="sm" onClick={onRegenerate} disabled={approved}>
          <RefreshCw className="w-3 h-3" /> Regenerate
        </Button>
        <div className="flex items-center gap-3">
          {approved && (
            <a href={bgm.url} download target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="md" className="gap-2">
                <Download className="w-3 h-3" /> Download Track
              </Button>
            </a>
          )}
          <Button
            variant={approved ? 'success' : 'primary'}
            size="md" onClick={onApprove} disabled={approved}
            className="gap-2"
          >
            {approved
              ? <><Check className="w-3 h-3" /> Approved</>
              : <>Approve Soundtrack <ArrowRight className="w-3 h-3" /></>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function readSession<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  const s = sessionStorage.getItem(key)
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function pollForBgm(
  projectId: string,
  onElapsed: (n: number) => void,
  maxAttempts = 24,
): Promise<Bgm> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(5000)
    onElapsed((i + 1) * 5)
    const res = await fetch(`/api/projects/${projectId}`)
    if (!res.ok) continue
    const { project } = await res.json()
    const bgms = project?.storyboard?.bgms
    if (bgms && bgms.length > 0) return bgms[bgms.length - 1]
  }
  throw new Error('Music generation timed out — please try again')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = 'generating' | 'polling' | 'ready' | 'error'

export default function SoundPage() {
  const router    = useRouter()
  const params    = useParams()
  const projectId = params?.id as string

  const [script,    setScript]    = useState<ScriptDocument | null>(null)
  const [video,     setVideo]     = useState<VideoResult | null>(null)
  const [bgm,       setBgm]       = useState<Bgm | null>(null)
  const [pageState, setPageState] = useState<PageState>('generating')
  const [error,     setError]     = useState<string | null>(null)
  const [approved,  setApproved]  = useState(false)
  const [elapsed,   setElapsed]   = useState(0)
  const generationStarted = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Elapsed ticker ────────────────────────────────────────────────────────
  useEffect(() => {
    if (pageState === 'generating' || pageState === 'polling') {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pageState])

  // ── Generate + poll ───────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    setError(null)
    setElapsed(0)
    setPageState('generating')
    try {
      const res = await fetch('/api/sound/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!res.ok) {
        const { error: err } = await res.json().catch(() => ({}))
        throw new Error(err || `Generation failed (${res.status})`)
      }
      setPageState('polling')
      setElapsed(0)
      const result = await pollForBgm(projectId, setElapsed)
      sessionStorage.setItem('directors-room-bgm', JSON.stringify(result))
      setBgm(result)
      setPageState('ready')
    } catch (err) {
      console.error('[sound] generate failed:', err)
      setError(String(err))
      setPageState('error')
    }
  }, [projectId])

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cachedScript = readSession<ScriptDocument>('directors-room-script')
    const cachedVideo  = readSession<VideoResult>('directors-room-video')
    const cachedBgm    = readSession<Bgm>('directors-room-bgm')

    if (cachedVideo)  setVideo(cachedVideo)
    if (cachedScript) setScript(cachedScript)

    if (cachedBgm) {
      setBgm(cachedBgm)
      setPageState('generating')
      setTimeout(() => setPageState('ready'), 1500)
      return
    }

    if (!generationStarted.current) {
      generationStarted.current = true
      generate()
    }
  }, [projectId, generate])

  const handleApprove = useCallback(() => setApproved(true), [])

  const handleRegenerate = useCallback(() => {
    sessionStorage.removeItem('directors-room-bgm')
    setBgm(null)
    setApproved(false)
    generationStarted.current = true
    generate()
  }, [generate])

  const generatingLabel = pageState === 'polling'
    ? 'Waiting for soundtrack…'
    : 'Composing soundtrack…'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Video',    href: `/video/${projectId}` },
          { label: 'Sound',    current: true },
        ]}
      />

      <WorkflowStepper current="sound" projectId={projectId} />

      {(pageState === 'generating' || pageState === 'polling') && (
        <GeneratingView elapsed={elapsed} label={generatingLabel} title={script?.title} />
      )}

      {pageState === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded border"
            style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
            <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
            <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={generate}>
            <RefreshCw className="w-3 h-3" /> Try again
          </Button>
        </div>
      )}

      {pageState === 'ready' && bgm && (
        <div className="flex-1 overflow-y-auto w-full">
          <ReadyView
            bgm={bgm}
            video={video}
            approved={approved}
            onApprove={handleApprove}
            onRegenerate={handleRegenerate}
          />
        </div>
      )}

      {(pageState === 'ready' || pageState === 'error') && (
        <div className="flex-none w-full border-t"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
          <div className="flex items-center justify-between py-4"
            style={{ maxWidth: 800, margin: '0 auto', paddingLeft: 40, paddingRight: 40 }}>
            <Button variant="secondary" size="sm"
              onClick={() => router.push(`/video/${projectId}`)}>
              <ArrowLeft className="w-3 h-3" /> Video
            </Button>
            {approved && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full"
                  style={{ background: 'var(--accent-green)' }} />
                <span className="text-[10px] font-slate"
                  style={{ color: 'var(--accent-green)' }}>
                  Soundtrack approved
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
