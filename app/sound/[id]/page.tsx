'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Music, Play, ArrowRight, ArrowLeft, Loader2, Check,
  Download, ChevronRight, AlertCircle, Pencil,
} from 'lucide-react'
import type { SoundResult, SoundVariation, SoundTrackMood, ScriptDocument, VideoResult } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import WorkflowStepper from '@/components/WorkflowStepper'
import Button from '@/components/ui/Button'

// ─── Constants ────────────────────────────────────────────────────────────────

const MOOD_LABELS: Record<SoundTrackMood, string> = {
  epic: 'Epic',
  tense: 'Tense',
  melancholic: 'Melancholic',
  uplifting: 'Uplifting',
  mysterious: 'Mysterious',
  romantic: 'Romantic',
  minimal: 'Minimal',
}

const MOOD_COLORS: Record<SoundTrackMood, string> = {
  epic: '#aa8844',
  tense: '#8a6a3a',
  melancholic: '#5a7a8a',
  uplifting: '#5a8a5a',
  mysterious: '#6a5a8a',
  romantic: '#8a5a6a',
  minimal: '#555555',
}

// ─── Procedural waveform ──────────────────────────────────────────────────────
// Generates a deterministic array of bar heights from a numeric seed.
// Each mood has a characteristic shape so variations feel distinct.

function generateWaveform(seed: number, bars = 40): number[] {
  const out: number[] = []
  for (let i = 0; i < bars; i++) {
    const x = Math.sin(seed * 9.7 + i * 0.7) * 0.5
      + Math.sin(seed * 3.1 + i * 1.3) * 0.3
      + Math.sin(seed * 17.3 + i * 0.4) * 0.2
    out.push(Math.max(0.08, Math.min(1, (x + 1) / 2)))
  }
  return out
}

// ─── Waveform component ───────────────────────────────────────────────────────

function Waveform({
  seed,
  color,
  animate,
  height = 40,
}: {
  seed: number
  color: string
  animate: boolean
  height?: number
}) {
  const bars = generateWaveform(seed)
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className={animate ? 'breathe' : ''}
          style={{
            width: 2,
            height: `${h * 100}%`,
            background: color,
            borderRadius: 1,
            opacity: animate ? 0.9 : 0.5,
            animationDelay: animate ? `${i * 40}ms` : undefined,
          }}
        />
      ))}
    </div>
  )
}

// ─── Editable brief field ─────────────────────────────────────────────────────

function BriefField({
  label,
  value,
  onChange,
  readOnly = false,
  multiline = false,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  readOnly?: boolean
  multiline?: boolean
}) {
  return (
    <div className="flex gap-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      <span
        className="flex-none text-[10px] tracking-[0.2em] uppercase font-slate pt-0.5"
        style={{ color: 'var(--text-muted)', width: 120 }}
      >
        {label}
      </span>
      {readOnly ? (
        <p className="text-sm font-light flex-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {value || '—'}
        </p>
      ) : multiline ? (
        <textarea
          value={value}
          onChange={e => onChange?.(e.target.value)}
          rows={2}
          className="flex-1 text-sm font-light leading-relaxed resize-none bg-transparent outline-none"
          style={{
            color: 'var(--text-secondary)',
            caretColor: 'var(--text-primary)',
            borderBottom: '1px solid transparent',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-amber)')}
          onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange?.(e.target.value)}
          className="flex-1 text-sm font-light bg-transparent outline-none"
          style={{
            color: 'var(--text-secondary)',
            caretColor: 'var(--text-primary)',
            borderBottom: '1px solid transparent',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-amber)')}
          onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
        />
      )}
    </div>
  )
}

// ─── Generating state ─────────────────────────────────────────────────────────

function GeneratingView({ elapsed }: { elapsed: number }) {
  const estimate = Math.max(0, 45 - elapsed)
  const bars = generateWaveform(42)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10">
      {/* Large decorative waveform */}
      <div className="flex items-end gap-[3px]" style={{ height: 80 }}>
        {bars.map((h, i) => (
          <div
            key={i}
            className="breathe"
            style={{
              width: 4,
              height: `${h * 100}%`,
              background: 'var(--accent-amber)',
              borderRadius: 2,
              opacity: 0.6,
              animationDelay: `${i * 50}ms`,
              animationDuration: `${1.8 + (i % 4) * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div className="text-center space-y-2">
        <p
          className="text-sm font-light breathe"
          style={{ color: 'var(--text-secondary)' }}
        >
          Composing variations…
        </p>
        <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
          ElevenLabs is scoring your 30-second teaser via Runway
        </p>
      </div>

      <p className="text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
        {elapsed < 5
          ? 'This takes about 45 seconds'
          : `~${estimate}s remaining`}
      </p>
    </div>
  )
}

// ─── Track card ───────────────────────────────────────────────────────────────

function TrackCard({
  variation,
  selected,
  playing,
  onSelect,
  onPreview,
}: {
  variation: SoundVariation
  selected: boolean
  playing: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  const color = MOOD_COLORS[variation.mood] ?? '#aa8844'

  return (
    <div
      className="rounded border p-5 space-y-4 transition-all duration-200 cursor-pointer"
      style={{
        borderColor: selected ? 'var(--accent-amber)' : 'var(--border-standard)',
        background: selected ? 'rgba(170,136,68,0.05)' : 'var(--surface-1)',
        boxShadow: selected ? '0 0 0 1px rgba(170,136,68,0.2)' : 'none',
      }}
      onClick={onSelect}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border-emphasis)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.borderColor = 'var(--border-standard)'
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {variation.name}
            </p>
            {selected && <Check className="w-3.5 h-3.5" style={{ color: 'var(--accent-amber)' }} />}
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-slate"
              style={{ background: `${color}18`, color }}
            >
              {MOOD_LABELS[variation.mood]}
            </span>
            <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
              {variation.duration}s
            </span>
          </div>
        </div>

        {/* Preview button */}
        <button
          onClick={e => { e.stopPropagation(); onPreview() }}
          className="flex-none flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-slate tracking-[0.1em] uppercase transition-all duration-150"
          style={{
            borderColor: playing ? color : 'var(--border-standard)',
            color: playing ? color : 'var(--text-tertiary)',
            background: playing ? `${color}10` : 'transparent',
          }}
        >
          {playing
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Play className="w-3 h-3" />
          }
          {playing ? 'Playing' : 'Preview'}
        </button>
      </div>

      {/* Waveform */}
      <Waveform
        seed={variation.waveformSeed}
        color={color}
        animate={selected || playing}
        height={36}
      />
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

function buildPrompt(brief: {
  tone: string; mood: string; narrativeArc: string; visualStyle: string; genre: string
}): string {
  return [
    `Genre: ${brief.genre}.`,
    `Tone: ${brief.tone}.`,
    `Mood arc: ${brief.mood}.`,
    `Narrative arc: ${brief.narrativeArc}.`,
    `Visual style: ${brief.visualStyle}.`,
    'Music only — no vocals, no dialogue, no sound effects.',
    'Duration: 30 seconds.',
  ].filter(Boolean).join(' ')
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'brief' | 'generating' | 'selection' | 'error'

export default function SoundPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  // Data
  const [script, setScript] = useState<ScriptDocument | null>(null)
  const [video, setVideo] = useState<VideoResult | null>(null)
  const [sound, setSound] = useState<SoundResult | null>(null)

  // Brief state (editable)
  const [tone, setTone] = useState('')
  const [mood, setMood] = useState('')
  const [narrativeArc, setNarrativeArc] = useState('')
  const [visualStyle, setVisualStyle] = useState('')
  const [genre, setGenre] = useState('')
  const [additionalDirection, setAdditionalDirection] = useState('')

  // UI state
  const [pageState, setPageState] = useState<PageState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [approved, setApproved] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cachedScript = readSession<ScriptDocument>('directors-room-script')
    const cachedVideo  = readSession<VideoResult>('directors-room-video')
    const cachedSound  = readSession<SoundResult>('directors-room-sound')

    if (cachedVideo) setVideo(cachedVideo)

    if (cachedSound && cachedSound.projectId === projectId) {
      setSound(cachedSound)
      if (cachedSound.approvedVariationId) setApproved(true)
      if (cachedSound.status === 'ready') {
        setPageState('selection')
        return
      }
    }

    // Populate brief from script
    if (cachedScript) {
      setScript(cachedScript)
      setTone(cachedScript.tone ?? '')
      setMood(cachedScript.tone ?? '')          // derive mood from tone as starting point
      setNarrativeArc(cachedScript.narrative_arc ?? '')
      setVisualStyle(cachedScript.visual_style ?? '')
      setGenre(cachedScript.genre ?? '')
    }

    setPageState('brief')
  }, [projectId])

  // ── Elapsed timer during generation ──────────────────────────────────────
  useEffect(() => {
    if (pageState === 'generating') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [pageState])

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setError(null)
    setPageState('generating')

    const prompt = buildPrompt({ tone, mood, narrativeArc, visualStyle, genre })

    try {
      const res = await fetch('/api/sound/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          prompt,
          additionalDirection: additionalDirection || null,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const { sound: result } = await res.json()
      sessionStorage.setItem('directors-room-sound', JSON.stringify(result))
      setSound(result)
      setPageState('selection')
    } catch (err) {
      setError(String(err))
      setPageState('brief')
    }
  }, [projectId, tone, mood, narrativeArc, visualStyle, genre, additionalDirection])

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = useCallback(() => {
    if (!sound || !selectedId) return
    const updated: SoundResult = { ...sound, approvedVariationId: selectedId }
    sessionStorage.setItem('directors-room-sound', JSON.stringify(updated))
    setSound(updated)
    setApproved(true)
  }, [sound, selectedId])

  // ── Preview ───────────────────────────────────────────────────────────────
  const handlePreview = useCallback((id: string) => {
    setPlayingId(prev => prev === id ? null : id)
    // In production: play variation.url in an <audio> element synced to video
  }, [])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
        <Sprocket />
        <TopBar breadcrumb={[{ label: 'Projects', href: '/' }, { label: 'Sound', current: true }]} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
        </div>
      </main>
    )
  }

  const selectedVariation = sound?.variations.find(v => v.id === selectedId) ?? null

  // ── Shell wrapper (shared across states) ──────────────────────────────────
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

      {/* ── GENERATING STATE ── */}
      {pageState === 'generating' && (
        <GeneratingView elapsed={elapsed} />
      )}

      {/* ── BRIEF STATE ── */}
      {pageState === 'brief' && (
        <div className="flex-1 overflow-y-auto w-full">
          <div style={{ maxWidth: 900, margin: '0 auto', paddingTop: 36, paddingBottom: 100, paddingLeft: 40, paddingRight: 40 }}>

            {/* Page header */}
            <div className="mb-8">
              <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Step 5 of 5
              </p>
              <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
                Sound Engineering
              </h1>
            </div>

            {error && (
              <div className="mb-6 rounded border px-4 py-3 flex items-center gap-3"
                style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
                <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
                <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>{error}</p>
              </div>
            )}

            <div className="grid gap-8" style={{ gridTemplateColumns: '1fr 280px' }}>
              {/* Left — soundtrack brief */}
              <div className="space-y-6">
                {/* Brief card */}
                <div
                  className="rounded border overflow-hidden"
                  style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
                >
                  {/* Card header */}
                  <div
                    className="flex items-center justify-between px-6 py-4 border-b"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="flex items-center gap-3">
                      <Music className="w-4 h-4" style={{ color: 'var(--accent-amber)' }} />
                      <span className="text-[10px] tracking-[0.25em] uppercase font-slate" style={{ color: 'var(--text-tertiary)' }}>
                        Soundtrack Brief
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Pencil className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                        Extracted from your script — edit any field
                      </span>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="px-6">
                    <BriefField label="Genre" value={genre} onChange={setGenre} />
                    <BriefField label="Tone" value={tone} onChange={setTone} />
                    <BriefField label="Mood arc" value={mood} onChange={setMood} />
                    <BriefField
                      label="Narrative arc"
                      value={narrativeArc}
                      onChange={setNarrativeArc}
                      multiline
                    />
                    <BriefField
                      label="Visual style"
                      value={visualStyle}
                      onChange={setVisualStyle}
                      multiline
                    />
                    <BriefField label="Duration" value="30 seconds" readOnly />
                    <BriefField label="Vocals" value="None — music only" readOnly />
                  </div>

                  {/* Additional direction */}
                  <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <p className="text-[10px] tracking-[0.2em] uppercase font-slate mb-3" style={{ color: 'var(--text-muted)' }}>
                      Additional direction
                    </p>
                    <textarea
                      value={additionalDirection}
                      onChange={e => setAdditionalDirection(e.target.value)}
                      placeholder="e.g. &quot;Music should feel like a Hans Zimmer score — sparse at the start, full orchestra at the climax&quot;"
                      rows={3}
                      className="w-full text-sm font-light leading-relaxed resize-none bg-transparent outline-none"
                      style={{
                        color: 'var(--text-secondary)',
                        caretColor: 'var(--text-primary)',
                        borderBottom: '1px solid transparent',
                        transition: 'border-color 0.15s',
                      }}
                      onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-amber)')}
                      onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
                    />
                    <p className="text-[10px] font-slate mt-2" style={{ color: 'var(--text-muted)' }}>
                      Optional — add any specific direction beyond what was captured above
                    </p>
                  </div>
                </div>

                {/* Prompt preview — what will actually be sent */}
                <div
                  className="rounded border px-5 py-4 space-y-2"
                  style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
                >
                  <p className="text-[10px] tracking-[0.2em] uppercase font-slate" style={{ color: 'var(--text-muted)' }}>
                    Prompt being sent to ElevenLabs via Runway
                  </p>
                  <p className="text-xs font-light leading-relaxed font-slate" style={{ color: 'var(--text-tertiary)' }}>
                    {buildPrompt({ tone, mood, narrativeArc, visualStyle, genre })}
                    {additionalDirection && ` ${additionalDirection}`}
                  </p>
                </div>
              </div>

              {/* Right — action panel */}
              <div>
                <div
                  className="rounded border p-6 space-y-5 sticky top-8"
                  style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
                >
                  {/* Project */}
                  {script?.title && (
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase font-slate mb-1" style={{ color: 'var(--text-muted)' }}>
                        Project
                      </p>
                      <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>
                        {script.title}
                      </p>
                    </div>
                  )}

                  <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

                  {/* What will happen */}
                  <div className="space-y-3">
                    {[
                      'Generate 4 unique variations',
                      'Scored to your narrative arc',
                      'Music only — no vocals',
                      '~30–45 seconds to complete',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <ChevronRight className="w-3 h-3 flex-none mt-0.5" style={{ color: 'var(--accent-amber)' }} />
                        <p className="text-xs font-light" style={{ color: 'var(--text-tertiary)' }}>{item}</p>
                      </div>
                    ))}
                  </div>

                  <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleGenerate}
                    className="w-full group gap-2"
                  >
                    Generate Soundtrack
                    <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SELECTION STATE ── */}
      {pageState === 'selection' && sound && (
        <div className="flex-1 overflow-y-auto w-full">
          <div style={{ maxWidth: 900, margin: '0 auto', paddingTop: 36, paddingBottom: 100, paddingLeft: 40, paddingRight: 40 }}>

            {/* Page header */}
            <div className="flex items-end justify-between mb-6">
              <div>
                <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Step 5 of 5
                </p>
                <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
                  Choose a Variation
                </h1>
              </div>
              {/* Regenerate brief link */}
              <button
                onClick={() => { setSound(null); setPageState('brief') }}
                className="text-[10px] tracking-[0.15em] uppercase font-slate transition-colors duration-150"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                Edit brief &amp; regenerate
              </button>
            </div>

            {/* Prompt used — small reference */}
            <div
              className="rounded border px-5 py-3 mb-8 flex items-start gap-3"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
            >
              <Music className="w-3.5 h-3.5 flex-none mt-0.5" style={{ color: 'var(--accent-amber)' }} />
              <p className="text-xs font-light leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Generated from: </span>
                {sound.prompt}
                {sound.additionalDirection && <> · {sound.additionalDirection}</>}
              </p>
            </div>

            <div className="grid gap-8" style={{ gridTemplateColumns: '1fr 280px' }}>
              {/* Left — video player + track cards */}
              <div className="space-y-6">
                {/* Video preview */}
                <div
                  className="rounded border overflow-hidden"
                  style={{ borderColor: 'var(--border-standard)', background: 'var(--canvas)' }}
                >
                  <div className="relative" style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}>
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
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
                        style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}
                      >
                        <Play className="w-6 h-6 fill-white text-white ml-0.5" />
                      </div>
                    </div>
                    {/* Viewfinder corners */}
                    <div className="absolute inset-5 pointer-events-none">
                      {['top-0 left-0 border-t border-l','top-0 right-0 border-t border-r','bottom-0 left-0 border-b border-l','bottom-0 right-0 border-b border-r'].map((c, i) => (
                        <div key={i} className={`absolute w-5 h-5 ${c}`} style={{ borderColor: 'var(--border-emphasis)' }} />
                      ))}
                    </div>
                  </div>
                  <div
                    className="px-5 py-3 flex items-center justify-between border-t"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <p className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                      {playingId
                        ? `Playing ${sound.variations.find(v => v.id === playingId)?.name ?? ''} against picture`
                        : 'Click Preview on a variation to hear it against picture'}
                    </p>
                    {playingId && (
                      <button
                        onClick={() => setPlayingId(null)}
                        className="text-[10px] font-slate"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Stop
                      </button>
                    )}
                  </div>
                </div>

                {/* Track cards */}
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {sound.variations.map(v => (
                    <TrackCard
                      key={v.id}
                      variation={v}
                      selected={selectedId === v.id}
                      playing={playingId === v.id}
                      onSelect={() => setSelectedId(v.id)}
                      onPreview={() => handlePreview(v.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Right — approve panel */}
              <div>
                <div
                  className="rounded border p-6 space-y-5 sticky top-8"
                  style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
                >
                  <div>
                    <p className="text-[10px] tracking-[0.2em] uppercase font-slate mb-3" style={{ color: 'var(--text-muted)' }}>
                      Selected
                    </p>
                    {selectedVariation ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {selectedVariation.name}
                        </p>
                        <span
                          className="inline-block text-[9px] px-1.5 py-0.5 rounded font-slate"
                          style={{
                            background: `${MOOD_COLORS[selectedVariation.mood]}18`,
                            color: MOOD_COLORS[selectedVariation.mood],
                          }}
                        >
                          {MOOD_LABELS[selectedVariation.mood]}
                        </span>
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                          <Waveform
                            seed={selectedVariation.waveformSeed}
                            color={MOOD_COLORS[selectedVariation.mood]}
                            animate
                            height={32}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                        Select a variation to preview and approve
                      </p>
                    )}
                  </div>

                  <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

                  <Button
                    variant={approved ? 'success' : 'primary'}
                    size="md"
                    onClick={handleApprove}
                    disabled={!selectedId || approved}
                    className="w-full gap-2"
                  >
                    {approved
                      ? <><Check className="w-3 h-3" /> Approved</>
                      : 'Approve Soundtrack'}
                  </Button>

                  {approved && (
                    <>
                      <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
                      <Button variant="secondary" size="sm" className="w-full gap-2">
                        <Download className="w-3 h-3" /> Export Final Video
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      {pageState !== 'generating' && (
        <div
          className="flex-none w-full border-t"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
        >
          <div
            className="flex items-center justify-between py-4"
            style={{ maxWidth: 900, margin: '0 auto', paddingLeft: 40, paddingRight: 40 }}
          >
            <Button variant="secondary" size="sm" onClick={() => router.push(`/video/${projectId}`)}>
              <ArrowLeft className="w-3 h-3" /> Video
            </Button>
            {pageState === 'selection' && approved && (
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
