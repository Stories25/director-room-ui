'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Play, ArrowRight, ArrowLeft, Loader2, Check,
  Download, AlertCircle, RefreshCw,
} from 'lucide-react'
import type { SoundResult, SoundVariation, SoundTrackMood, ScriptDocument, VideoResult } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import WorkflowStepper from '@/components/WorkflowStepper'
import Button from '@/components/ui/Button'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_LABELS: Record<SoundTrackMood, string> = {
  epic: 'Epic', tense: 'Tense', melancholic: 'Melancholic',
  uplifting: 'Uplifting', mysterious: 'Mysterious', romantic: 'Romantic', minimal: 'Minimal',
}

const MOOD_COLORS: Record<SoundTrackMood, string> = {
  epic: '#aa8844', tense: '#8a6a3a', melancholic: '#5a7a8a',
  uplifting: '#5a8a5a', mysterious: '#6a5a8a', romantic: '#8a5a6a', minimal: '#555555',
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

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

// Rendered client-only to avoid SSR/client style serialization mismatch
// (Math.sin produces floats; React style numbers serialize differently on server vs client)
function WaveformInner({ seed, color, animate, height = 48 }: {
  seed: number; color: string; animate: boolean; height?: number
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
            background: color,
            borderRadius: '1px',
            opacity: animate ? 0.85 : 0.45,
            animationDelay: animate ? `${i * 35}ms` : undefined,
            animationDuration: animate ? `${(1.6 + (i % 5) * 0.2).toFixed(1)}s` : undefined,
          }}
        />
      ))}
    </div>
  )
}

const Waveform = dynamic(() => Promise.resolve(WaveformInner), { ssr: false })

// ─── Generating view ──────────────────────────────────────────────────────────

function GeneratingViewInner({ elapsed, title }: { elapsed: number; title?: string }) {
  const estimate = Math.max(0, 45 - elapsed)
  const bars = generateWaveform(42, 56)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10">
      {/* Large animated waveform */}
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
          Composing soundtrack…
        </p>
        <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
          ElevenLabs is scoring your 30-second teaser via Runway
        </p>
      </div>

      <p className="text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {elapsed < 5 ? 'This takes about 45 seconds' : `~${estimate}s remaining`}
      </p>
    </div>
  )
}

const GeneratingView = dynamic(() => Promise.resolve(GeneratingViewInner), { ssr: false })

// ─── Ready view ───────────────────────────────────────────────────────────────

function ReadyView({
  variation,
  video,
  approved,
  onApprove,
  onRegenerate,
  isRegenerating,
}: {
  variation: SoundVariation
  video: VideoResult | null
  approved: boolean
  onApprove: () => void
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const color = MOOD_COLORS[variation.mood] ?? 'var(--accent-amber)'

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 40, paddingBottom: 100, paddingLeft: 40, paddingRight: 40 }}>

      {/* Page header */}
      <div className="mb-8">
        <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Step 5 of 5
        </p>
        <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
          Sound Engineering
        </h1>
      </div>

      {/* Video + audio preview */}
      <div className="rounded border overflow-hidden mb-8" style={{ borderColor: 'var(--border-standard)', background: 'var(--canvas)' }}>
        {/* 16:9 player */}
        <div className="relative w-full" style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}>
          {video?.clips?.[0]?.thumbnailUrl ? (
            <img
              src={video.clips[0].thumbnailUrl}
              alt="Preview"
              className="w-full h-full object-cover opacity-50"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Play className="w-8 h-8" style={{ color: 'var(--border-emphasis)' }} />
            </div>
          )}
          {/* Viewfinder corners */}
          <div className="absolute inset-5 pointer-events-none">
            {['top-0 left-0 border-t border-l','top-0 right-0 border-t border-r',
              'bottom-0 left-0 border-b border-l','bottom-0 right-0 border-b border-r'].map((c, i) => (
              <div key={i} className={`absolute w-5 h-5 ${c}`} style={{ borderColor: 'var(--border-emphasis)' }} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)' }}>
              <Play className="w-6 h-6 fill-white text-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Waveform bar beneath player */}
        <div
          className="px-6 py-4 border-t flex items-center gap-4"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
        >
          <div className="flex-1">
            <Waveform seed={variation.waveformSeed} color={color} animate={!approved} height={40} />
          </div>
          <div className="flex items-center gap-3 flex-none">
            <span
              className="text-[9px] px-2 py-1 rounded font-slate"
              style={{ background: `${color}18`, color }}
            >
              {MOOD_LABELS[variation.mood]}
            </span>
            <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
              {variation.duration}s
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={onRegenerate}
          disabled={isRegenerating || approved}
        >
          {isRegenerating
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating</>
            : <><RefreshCw className="w-3 h-3" /> Regenerate</>
          }
        </Button>

        <div className="flex items-center gap-3">
          {approved && (
            <Button variant="secondary" size="md" className="gap-2">
              <Download className="w-3 h-3" /> Export Final Video
            </Button>
          )}
          <Button
            variant={approved ? 'success' : 'primary'}
            size="md"
            onClick={onApprove}
            disabled={approved}
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

function buildPrompt(script: ScriptDocument | null): string {
  if (!script) return 'Cinematic orchestral score. Music only. No vocals. 30 seconds.'
  return [
    script.genre && `Genre: ${script.genre}.`,
    script.tone && `Tone: ${script.tone}.`,
    script.narrative_arc && `Narrative arc: ${script.narrative_arc}.`,
    script.visual_style && `Visual style: ${script.visual_style}.`,
    'Music only — no vocals, no dialogue, no sound effects.',
    'Duration: 30 seconds.',
  ].filter(Boolean).join(' ')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = 'generating' | 'ready' | 'error'

export default function SoundPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const [script, setScript] = useState<ScriptDocument | null>(null)
  const [video, setVideo] = useState<VideoResult | null>(null)
  const [sound, setSound] = useState<SoundResult | null>(null)
  // Start in 'generating' — the boot effect will override to 'ready' if cached
  const [pageState, setPageState] = useState<PageState>('generating')
  const [error, setError] = useState<string | null>(null)
  const [approved, setApproved] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const generationStarted = useRef(false)

  // ── Generate ──────────────────────────────────────────────────────────────
  const generate = useCallback(async (scriptData: ScriptDocument | null) => {
    setError(null)
    setPageState('generating')
    const prompt = buildPrompt(scriptData)
    try {
      const res = await fetch('/api/sound/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, prompt }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { sound: result } = await res.json()
      // Keep only the first variation
      const single: SoundResult = { ...result, variations: result.variations.slice(0, 1) }
      sessionStorage.setItem('directors-room-sound', JSON.stringify(single))
      setSound(single)
      setPageState('ready')
    } catch (err) {
      setError(String(err))
      setPageState('error')
    }
  }, [projectId])

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cachedScript = readSession<ScriptDocument>('directors-room-script')
    const cachedVideo  = readSession<VideoResult>('directors-room-video')
    const cachedSound  = readSession<SoundResult>('directors-room-sound')

    if (cachedVideo)  setVideo(cachedVideo)
    if (cachedScript) setScript(cachedScript)

    // Already have a result — go straight to ready
    if (cachedSound && cachedSound.projectId === projectId && cachedSound.status === 'ready') {
      setSound(cachedSound)
      if (cachedSound.approvedVariationId) setApproved(true)
      setPageState('ready')
      return
    }

    // Auto-generate immediately — guard against StrictMode double-fire
    if (!generationStarted.current) {
      generationStarted.current = true
      setPageState('generating')  // set synchronously so first render shows animation
      generate(cachedScript)
    }
  }, [projectId, generate])

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (pageState === 'generating') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pageState])

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = useCallback(() => {
    if (!sound) return
    const updated: SoundResult = {
      ...sound,
      approvedVariationId: sound.variations[0]?.id ?? null,
    }
    sessionStorage.setItem('directors-room-sound', JSON.stringify(updated))
    setSound(updated)
    setApproved(true)
  }, [sound])

  // ── Regenerate ────────────────────────────────────────────────────────────
  const handleRegenerate = useCallback(() => {
    sessionStorage.removeItem('directors-room-sound')
    setSound(null)
    setApproved(false)
    generate(script)
  }, [script, generate])

  // ── Shell ─────────────────────────────────────────────────────────────────
  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Video', href: `/video/${projectId}` },
          { label: 'Sound', current: true },
        ]}
      />

      <WorkflowStepper current="sound" projectId={projectId} />

      {/* ── Generating ── */}
      {pageState === 'generating' && (
        <GeneratingView elapsed={elapsed} title={script?.title} />
      )}

      {/* ── Error ── */}
      {pageState === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded border"
            style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
            <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
            <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => generate(script)}>
            <RefreshCw className="w-3 h-3" /> Try again
          </Button>
        </div>
      )}

      {/* ── Ready ── */}
      {pageState === 'ready' && sound?.variations[0] && (
        <div className="flex-1 overflow-y-auto w-full">
          <ReadyView
            variation={sound.variations[0]}
            video={video}
            approved={approved}
            onApprove={handleApprove}
            onRegenerate={handleRegenerate}
            isRegenerating={false}
          />
        </div>
      )}

      {/* ── Bottom bar ── */}
      {pageState !== 'generating' && (
        <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
          <div className="flex items-center justify-between py-4"
            style={{ maxWidth: 800, margin: '0 auto', paddingLeft: 40, paddingRight: 40 }}>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/video/${projectId}`)}>
              <ArrowLeft className="w-3 h-3" /> Video
            </Button>
            {approved && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent-green)' }} />
                <span className="text-[10px] font-slate" style={{ color: 'var(--accent-green)' }}>
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
