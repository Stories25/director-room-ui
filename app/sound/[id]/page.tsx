'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Music, Play, ArrowRight, ArrowLeft, Loader2, Check,
  Download, AlertCircle, ChevronDown,
} from 'lucide-react'
import type { SoundResult, SoundVariation, SoundTrackMood, ScriptDocument, StoryboardResult } from '@/lib/types'
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

// ─── Inline editable field ────────────────────────────────────────────────────

function BriefField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
}) {
  const isEmpty = !value.trim()

  const sharedStyle: React.CSSProperties = {
    color: isEmpty ? 'var(--text-muted)' : 'var(--text-primary)',
    caretColor: 'var(--text-primary)',
    fontStyle: isEmpty ? 'italic' : 'normal',
    transition: 'border-color 0.15s, color 0.15s',
    borderBottom: '1px solid var(--border-standard)',
  }

  return (
    <div className="py-7 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      {/* Label — small amber-tinted caps, clearly a label not content */}
      <p
        className="text-[10px] tracking-[0.2em] uppercase mb-3"
        style={{ color: 'var(--accent-amber)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}
      >
        {label}
      </p>

      {multiline ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={value ? Math.max(2, value.split('\n').length) : 2}
          className="brief-input w-full text-base font-light leading-relaxed resize-none bg-transparent outline-none"
          style={sharedStyle}
          onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-amber)')}
          onBlur={e => (e.target.style.borderBottomColor = 'var(--border-standard)')}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="brief-input w-full text-base font-light bg-transparent outline-none"
          style={sharedStyle}
          onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-amber)')}
          onBlur={e => (e.target.style.borderBottomColor = 'var(--border-standard)')}
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
  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null)
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
  const [promptOpen, setPromptOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const cachedScript = readSession<ScriptDocument>('directors-room-script')
    const cachedStoryboard = readSession<StoryboardResult>('directors-room-storyboard')
    const cachedSound  = readSession<SoundResult>('directors-room-sound')

    if (cachedStoryboard) setStoryboard(cachedStoryboard)

    // Restore cached sound state (but never skip brief population)
    if (cachedSound && cachedSound.projectId === projectId) {
      setSound(cachedSound)
      if (cachedSound.approvedVariationId) setApproved(true)
      // If already generated, go straight to selection
      if (cachedSound.status === 'ready') {
        // Still populate brief fields so "edit brief" works correctly
        if (cachedScript) {
          setScript(cachedScript)
          setTone(cachedScript.tone ?? '')
          setMood(cachedScript.tone ?? '')
          setNarrativeArc(cachedScript.narrative_arc ?? '')
          setVisualStyle(cachedScript.visual_style ?? '')
          setGenre(cachedScript.genre ?? '')
        }
        setPageState('selection')
        return
      }
    }

    // Populate brief from script (session or API fallback)
    if (cachedScript) {
      setScript(cachedScript)
      setTone(cachedScript.tone ?? '')
      setMood(cachedScript.tone ?? '')
      setNarrativeArc(cachedScript.narrative_arc ?? '')
      setVisualStyle(cachedScript.visual_style ?? '')
      setGenre(cachedScript.genre ?? '')
      setPageState('brief')
    } else {
      // No script in session — fetch project from API for title at minimum,
      // then prompt the user to navigate back through the workflow
      fetch(`/api/projects/${projectId}`)
        .then(r => r.json())
        .then(({ project }) => {
          if (project?.title) {
            setScript({ title: project.title } as ScriptDocument)
          }
        })
        .catch(() => {/* non-fatal */})
        .finally(() => setPageState('brief'))
    }
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
          <div style={{ maxWidth: 860, margin: '0 auto', paddingTop: 40, paddingBottom: 120, paddingLeft: 40, paddingRight: 40 }}>

            {/* Error */}
            {error && (
              <div className="mb-8 rounded border px-4 py-3 flex items-center gap-3"
                style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
                <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
                <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>{error}</p>
              </div>
            )}

            {/* No script warning — session lost or cold load */}
            {!tone && !narrativeArc && !visualStyle && (
              <div className="mb-8 rounded border px-4 py-3 flex items-center justify-between gap-4"
                style={{ borderColor: 'rgba(170,136,68,0.2)', background: 'rgba(170,136,68,0.04)' }}>
                <p className="text-xs font-light" style={{ color: 'var(--accent-warm)' }}>
                  Script data not found in this session. Fields have been left blank — fill them in manually, or go back through the workflow to auto-populate.
                </p>
                <Button variant="secondary" size="sm" onClick={() => router.push('/script')}>
                  <ArrowLeft className="w-3 h-3" /> Back to Script
                </Button>
              </div>
            )}

            <div className="grid gap-16" style={{ gridTemplateColumns: '1fr 240px' }}>

              {/* ── Left — document ── */}
              <div>
                {/* Page header */}
                <div className="mb-10">
                  <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-2" style={{ color: 'var(--text-muted)' }}>
                    Step 5 of 5
                  </p>
                  <h1 className="text-3xl font-display font-light leading-none mb-3" style={{ color: 'var(--text-primary)' }}>
                    Sound Engineering
                  </h1>
                  {/* Genre tag + meta line */}
                  <div className="flex items-center gap-3">
                    {genre && (
                      <span
                        className="text-[9px] tracking-[0.2em] uppercase font-slate px-2 py-1 rounded border"
                        style={{ color: 'var(--accent-amber)', borderColor: 'rgba(170,136,68,0.3)', background: 'rgba(170,136,68,0.06)' }}
                      >
                        {genre}
                      </span>
                    )}
                    <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                      30s · Music only · No vocals
                    </span>
                  </div>
                </div>

                {/* Section label + amber rule */}
                <div className="flex items-center gap-4 mb-2">
                  <p className="text-[10px] tracking-[0.25em] uppercase font-slate flex-none" style={{ color: 'var(--text-muted)' }}>
                    Soundtrack Brief
                  </p>
                  <div className="flex-1 h-px" style={{ background: 'var(--accent-amber)', opacity: 0.25 }} />
                </div>
                <p className="text-xs font-light mb-6" style={{ color: 'var(--text-muted)' }}>
                  Extracted from your script — edit any field before generating.
                </p>

                {/* Fields — bare, no card wrapper */}
                <BriefField
                  label="Tone & mood"
                  value={tone}
                  onChange={v => { setTone(v); setMood(v) }}
                  placeholder="e.g. Dark, gritty, building tension"
                />
                <BriefField
                  label="Narrative arc"
                  value={narrativeArc}
                  onChange={setNarrativeArc}
                  multiline
                  placeholder="e.g. Setup (8s) → Confrontation (14s) → Resolution (8s)"
                />
                <BriefField
                  label="Visual style"
                  value={visualStyle}
                  onChange={setVisualStyle}
                  multiline
                  placeholder="e.g. High contrast, noir, handheld"
                />

                {/* Additional direction */}
                <div className="py-7">
                  <p
                    className="text-[10px] tracking-[0.2em] uppercase mb-3"
                    style={{ color: 'var(--accent-amber)', opacity: 0.7, fontFamily: 'var(--font-mono)' }}
                  >
                    Additional direction{' '}
                    <span style={{ opacity: 0.5, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0 }}>
                      — optional
                    </span>
                  </p>
                  <textarea
                    value={additionalDirection}
                    onChange={e => setAdditionalDirection(e.target.value)}
                    placeholder={`e.g. "Sparse at the start, full orchestra at the climax — Hans Zimmer style"`}
                    rows={2}
                    className="brief-input w-full text-base font-light leading-relaxed resize-none bg-transparent outline-none"
                    style={{
                      color: additionalDirection ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontStyle: additionalDirection ? 'normal' : 'italic',
                      caretColor: 'var(--text-primary)',
                      borderBottom: '1px solid var(--border-standard)',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                    onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-amber)')}
                    onBlur={e => (e.target.style.borderBottomColor = 'var(--border-standard)')}
                  />
                </div>

                {/* Prompt disclosure */}
                <button
                  onClick={() => setPromptOpen(p => !p)}
                  className="flex items-center gap-2 text-[10px] font-slate tracking-[0.1em] transition-colors duration-150 mt-2"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  <ChevronDown
                    className="w-3 h-3 transition-transform duration-200"
                    style={{ transform: promptOpen ? 'rotate(180deg)' : 'rotate(-90deg)' }}
                  />
                  {promptOpen ? 'Hide' : 'View'} exact prompt being sent to ElevenLabs via Runway
                </button>

                {promptOpen && (
                  <div
                    className="mt-3 px-4 py-3 rounded border fade-up"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
                  >
                    <p className="text-xs font-light leading-relaxed font-slate" style={{ color: 'var(--text-tertiary)' }}>
                      {buildPrompt({ tone, mood, narrativeArc, visualStyle, genre })}
                      {additionalDirection && ` ${additionalDirection}`}
                    </p>
                  </div>
                )}
              </div>

              {/* ── Right — sticky action panel ── */}
              <div className="pt-16">
                <div
                  className="rounded border p-6 space-y-5 sticky top-8"
                  style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
                >
                  {script?.title && (
                    <div>
                      <p className="text-[10px] tracking-[0.2em] uppercase font-slate mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Project
                      </p>
                      <p className="text-sm font-light leading-snug" style={{ color: 'var(--text-secondary)' }}>
                        {script.title}
                      </p>
                    </div>
                  )}

                  <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

                  <p className="text-xs font-light leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                    4 variations · scored to your narrative arc · ~30–45s to generate
                  </p>

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
                    {(() => {
                      const firstShotKey = storyboard ? Object.keys(storyboard.shots).sort()[0] : null
                      const firstShot = firstShotKey ? storyboard!.shots[firstShotKey] : null
                      const thumbUrl = firstShot?.image?.generations?.[firstShot.image.generations.length - 1]?.url
                      return thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt="Preview"
                          className="w-full h-full object-cover opacity-50"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-8 h-8" style={{ color: 'var(--border-emphasis)' }} />
                        </div>
                      )
                    })()}
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
