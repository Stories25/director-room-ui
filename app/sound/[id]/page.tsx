'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Play, Pause, ArrowRight, ArrowLeft,
  Loader2, AlertCircle, RefreshCw, Volume2, Check,
} from 'lucide-react'
import type { Bgm, BgmTimestamp } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import WorkflowStepper from '@/components/WorkflowStepper'
import Button from '@/components/ui/Button'

// ─── Palette ──────────────────────────────────────────────────────────────────
const GOLD        = '#C8921C'
const GOLD_BRIGHT = '#E8B234'
const GOLD_DIM    = 'rgba(200,146,28,0.14)'

// ─── Timeline geometry (matches SVG viewBox 680 wide) ────────────────────────
const VW   = 680
const LW   = 52    // label column width
const TW   = VW - LW - 8
const SVG_H = 220

const ROW = {
  ruler:  { y: 0,   h: 20 },
  wave:   { y: 24,  h: 44 },
  shots:  { y: 72,  h: 34 },
  energy: { y: 110, h: 36 },
  stage:  { y: 150, h: 18 },
  vol:    { y: 172, h: 44 },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function xOf(ms: number, durMs: number): number {
  return LW + (ms / durMs) * TW
}

/** Merge consecutive shots with same dynamic_note into stage bands */
function mergeStages(ts: BgmTimestamp[]): { n: string; s: number; e: number }[] {
  const out: { n: string; s: number; e: number }[] = []
  ts.forEach(t => {
    const last = out[out.length - 1]
    if (!last || last.n !== t.dynamic_note) {
      out.push({ n: t.dynamic_note, s: t.start_ms, e: t.end_ms })
    } else {
      last.e = t.end_ms
    }
  })
  return out
}

/** Energy filled-area SVG path */
function mkEnergyPath(
  ts: BgmTimestamp[],
  durMs: number,
): string {
  const { y, h } = ROW.energy
  const toY = (en: number) => y + h - (en / 5) * h
  if (ts.length === 0) return ''
  let d = `M${xOf(ts[0].start_ms, durMs)} ${y + h} L${xOf(ts[0].start_ms, durMs)} ${toY(ts[0].energy)}`
  ts.forEach((t, i) => {
    if (i > 0) d += ` L${xOf(t.start_ms, durMs)} ${toY(t.energy)}`
    d += ` L${xOf(t.end_ms, durMs)} ${toY(t.energy)}`
  })
  return d + ` L${xOf(ts[ts.length - 1].end_ms, durMs)} ${y + h} Z`
}

// ─── Decode real MP3 waveform via AudioContext ─────────────────────────────────
// Returns N normalised bar heights [0..1] sampled from the audio channel data.
// Runs entirely in the browser — no server needed.

async function decodeMp3Waveform(url: string, bars = 70): Promise<number[]> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  const audio = await ctx.decodeAudioData(buf)
  ctx.close()

  const data = audio.getChannelData(0)
  const blockSize = Math.floor(data.length / bars)
  const out: number[] = []
  for (let i = 0; i < bars; i++) {
    let sum = 0
    for (let j = 0; j < blockSize; j++) sum += Math.abs(data[i * blockSize + j])
    out.push(sum / blockSize)
  }
  const max = Math.max(...out, 0.001)
  return out.map(v => Math.max(0.05, v / max))
}

// ─── Waveform SVG row — client-only ──────────────────────────────────────────
// Rendered client-only (dynamic) to avoid SSR hydration mismatch.

function WaveRowInner({
  heights,
  playedPct,
}: {
  heights: number[]
  playedPct: number
}) {
  const { y, h } = ROW.wave
  return (
    <>
      {heights.map((amp, i) => {
        const bw  = TW / heights.length - 0.6
        const bh  = Math.max(2, amp * (h - 6))
        const bx  = LW + i * (TW / heights.length)
        const by  = y + h / 2 - bh / 2
        const pct = i / heights.length
        const played = pct < playedPct
        return (
          <rect
            key={i}
            x={bx} y={by} width={bw} height={bh}
            fill={GOLD}
            opacity={played ? 0.75 : 0.28}
            rx={0.5}
          />
        )
      })}
    </>
  )
}

const WaveRow = dynamic(() => Promise.resolve(WaveRowInner), { ssr: false })

// ─── Timeline SVG ─────────────────────────────────────────────────────────────

function TimelineSvg({
  bgm,
  time,
  onSeek,
}: {
  bgm: Bgm
  time: number
  onSeek: (t: number) => void
}) {
  const dur    = bgm.duration_ms
  const durS   = dur / 1000
  const stages = mergeStages(bgm.timestamps)
  const epath  = mkEnergyPath(bgm.timestamps, dur)
  const playX  = xOf(time * 1000, dur)
  const playedPct = time / durS

  const svgRef = useRef<SVGSVGElement>(null)

  const [waveHeights, setWaveHeights] = useState<number[]>([])
  const [waveLoading, setWaveLoading] = useState(true)

  // Decode real waveform from MP3 on mount
  useEffect(() => {
    if (!bgm.url) return
    setWaveLoading(true)
    decodeMp3Waveform(bgm.url, 70)
      .then(h => { setWaveHeights(h); setWaveLoading(false) })
      .catch(() => {
        // Fallback to seeded synthetic waveform if decode fails
        const seed = bgm.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
        const fallback = Array.from({ length: 70 }, (_, i) => {
          const p = i / 69
          return Math.max(0.05, Math.sin(p * Math.PI) * 0.7 + Math.sin(p * 29) * 0.1 + 0.1)
        })
        setWaveHeights(fallback)
        setWaveLoading(false)
      })
  }, [bgm.url, bgm.id])

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX  = (e.clientX - rect.left) / (rect.width / VW)
    if (svgX < LW || svgX > LW + TW) return
    const pct = (svgX - LW) / TW
    onSeek(Math.max(0, Math.min(1, pct)) * durS)
  }, [durS, onSeek])

  const rowLabels: [string, { y: number; h: number }][] = [
    ['AUDIO',  ROW.wave],
    ['SHOTS',  ROW.shots],
    ['ENERGY', ROW.energy],
    ['VOLUME', ROW.vol],
  ]

  return (
    <svg
      ref={svgRef}
      width="100%"
      viewBox={`0 0 ${VW} ${SVG_H}`}
      onClick={handleClick}
      style={{ display: 'block', cursor: 'crosshair' }}
    >
      {/* Row backgrounds */}
      {[ROW.wave, ROW.shots, ROW.energy, ROW.vol].map(({ y, h }) => (
        <rect
          key={y}
          x={LW} y={y} width={TW} height={h}
          fill="rgba(255,255,255,0.013)" rx={2}
        />
      ))}

      {/* Row top separators */}
      {[ROW.ruler, ROW.wave, ROW.shots, ROW.energy, ROW.vol].map(({ y }) => (
        <line key={y} x1={LW} y1={y} x2={LW + TW} y2={y}
          stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
      ))}

      {/* Row labels */}
      {rowLabels.map(([label, { y, h }]) => (
        <text
          key={label}
          x={LW - 6} y={y + h / 2}
          textAnchor="end" dominantBaseline="middle"
          fontSize={7} fill="var(--text-muted)"
          letterSpacing={0.9}
          fontFamily="system-ui"
        >
          {label}
        </text>
      ))}

      {/* Time ruler */}
      <line x1={LW} y1={ROW.ruler.h} x2={LW + TW} y2={ROW.ruler.h}
        stroke="var(--text-muted)" strokeWidth={0.3} opacity={0.4} />
      {[0, 5, 10, 15, 20, 25, 30].map(s => {
        const rx = xOf(s * 1000, dur)
        return (
          <g key={s}>
            <line x1={rx} y1={ROW.ruler.h - 4} x2={rx} y2={ROW.ruler.h}
              stroke="var(--text-muted)" strokeWidth={0.5} />
            <text
              x={rx} y={ROW.ruler.h - 6}
              textAnchor={s === 0 ? 'start' : s === 30 ? 'end' : 'middle'}
              fontSize={7} fill="var(--text-muted)"
              fontFamily="var(--font-mono)"
            >
              {s}s
            </text>
          </g>
        )
      })}

      {/* Waveform row */}
      {!waveLoading && waveHeights.length > 0 && (
        <WaveRow heights={waveHeights} playedPct={playedPct} />
      )}
      {waveLoading && (
        <rect
          x={LW} y={ROW.wave.y} width={TW} height={ROW.wave.h}
          fill="rgba(200,146,28,0.05)" rx={2}
        />
      )}

      {/* Shot strip */}
      {bgm.timestamps.map(t => {
        const x1 = xOf(t.start_ms, dur)
        const x2 = xOf(t.end_ms, dur)
        const w  = x2 - x1 - 1.5
        const active = time >= t.start_ms / 1000 && time < t.end_ms / 1000
        return (
          <g key={t.shot_id}>
            <rect
              x={x1 + 0.75} y={ROW.shots.y + 2}
              width={w} height={ROW.shots.h - 4}
              fill={active ? GOLD_DIM : 'rgba(255,255,255,0.02)'}
              stroke={active ? GOLD : 'rgba(255,255,255,0.06)'}
              strokeWidth={active ? 1 : 0.5}
              rx={2}
            />
            <text
              x={(x1 + x2) / 2} y={ROW.shots.y + ROW.shots.h / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={8.5}
              fill={active ? GOLD_BRIGHT : 'var(--text-muted)'}
              fontFamily="var(--font-mono)"
            >
              {t.shot_id}
            </text>
          </g>
        )
      })}

      {/* Energy area */}
      {epath && (
        <path
          d={epath}
          fill={GOLD} opacity={0.2}
          stroke={GOLD} strokeWidth={0.8} strokeOpacity={0.5}
        />
      )}

      {/* Stage boundary ticks */}
      {stages.slice(0, -1).map(g => (
        <line
          key={g.e}
          x1={xOf(g.e, dur)} y1={ROW.energy.y}
          x2={xOf(g.e, dur)} y2={ROW.stage.y + ROW.stage.h}
          stroke="var(--text-muted)" strokeWidth={0.4}
          strokeDasharray="2 2" opacity={0.4}
        />
      ))}

      {/* Stage labels */}
      {stages.map(g => (
        <text
          key={`${g.n}${g.s}`}
          x={(xOf(g.s, dur) + xOf(g.e, dur)) / 2}
          y={ROW.stage.y + ROW.stage.h / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={7.5} fill="var(--text-muted)"
          letterSpacing={0.8} fontFamily="system-ui"
        >
          {g.n}
        </text>
      ))}

      {/* Volume curve */}
      <polyline
        points={bgm.timestamps.map(t => {
          const mx = (xOf(t.start_ms, dur) + xOf(t.end_ms, dur)) / 2
          const vy = ROW.vol.y + ROW.vol.h - 6 - t.volume * (ROW.vol.h - 12)
          return `${mx},${vy}`
        }).join(' ')}
        fill="none" stroke={GOLD} strokeWidth={1.2} opacity={0.55}
      />
      {bgm.timestamps.map(t => {
        const mx     = (xOf(t.start_ms, dur) + xOf(t.end_ms, dur)) / 2
        const vy     = ROW.vol.y + ROW.vol.h - 6 - t.volume * (ROW.vol.h - 12)
        const active = time >= t.start_ms / 1000 && time < t.end_ms / 1000
        return (
          <g key={`v${t.shot_id}`}>
            <circle cx={mx} cy={vy} r={active ? 5 : 4} fill="var(--canvas)" />
            <circle
              cx={mx} cy={vy} r={active ? 3 : 2.5}
              fill={GOLD} opacity={active ? 0.9 : 0.65}
            />
          </g>
        )
      })}

      {/* Playhead */}
      <line
        x1={playX} y1={0} x2={playX} y2={SVG_H}
        stroke={GOLD_BRIGHT} strokeWidth={0.9} opacity={0.9}
      />
      <polygon
        points={`${playX - 4.5},0 ${playX + 4.5},0 ${playX},9`}
        fill={GOLD_BRIGHT}
      />
    </svg>
  )
}

// ─── Alternates strip ──────────────────────────────────────────────────────────

function AlternatesStrip({
  bgms,
  activeId,
  onPick,
}: {
  bgms: Bgm[]
  activeId: string
  onPick: (id: string) => void
}) {
  const alts = bgms.filter(b => b.id !== activeId)
  if (alts.length === 0) return null

  return (
    <div className="mb-5">
      <p
        className="text-[9px] tracking-[0.12em] uppercase font-slate mb-3"
        style={{ color: 'var(--text-muted)' }}
      >
        Alternates · {alts.length} — tap to audition
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {alts.map((t, i) => {
          const bpm = t.prompt.match(/(\d+)\s*BPM/i)?.[1] ?? '—'
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className="flex-none rounded border text-left transition-all duration-150"
              style={{
                width: 110,
                padding: '9px 11px 8px',
                background: 'var(--surface-2)',
                borderColor: 'var(--border-subtle)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-emphasis)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
            >
              <p className="text-[9px] font-slate mb-2" style={{ color: 'var(--text-muted)' }}>
                Track {bgms.findIndex(b => b.id === t.id) + 1}
              </p>
              {/* Mini waveform — 20 synthetic bars */}
              <svg width="88" height="14" viewBox="0 0 88 14" style={{ display: 'block', marginBottom: 5 }}>
                {Array.from({ length: 20 }, (_, j) => {
                  const seed = t.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                  const p = j / 19
                  const h = Math.max(0.1, Math.sin(p * Math.PI + seed) * 0.6 + 0.45 + Math.sin(p * 7 + seed * 0.1) * 0.15)
                  return (
                    <rect
                      key={j}
                      x={j * 4.4} y={(1 - h) * 14}
                      width={3.4} height={h * 14}
                      fill="var(--text-muted)" rx={0.5}
                    />
                  )
                })}
              </svg>
              <p className="text-[8px] font-slate" style={{ color: 'var(--text-muted)' }}>
                {bpm} BPM
              </p>
            </button>
          )
        })}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'idle' | 'generating' | 'ready' | 'error'

export default function SoundPage() {
  const router    = useRouter()
  const params    = useParams()
  const projectId = params?.id as string

  const [projectTitle,  setProjectTitle]  = useState<string | null>(null)
  const [bgms,          setBgms]          = useState<Bgm[]>([])
  const [activeBgmId,   setActiveBgmId]   = useState<string | null>(null)
  const [pageState,     setPageState]     = useState<PageState>('loading')
  const [error,         setError]         = useState<string | null>(null)
  const [isGenerating,  setIsGenerating]  = useState(false)
  const [approved,      setApproved]      = useState(false)

  // Playback state
  const [playing, setPlaying]   = useState(false)
  const [time,    setTime]      = useState(0)
  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const rafRef    = useRef<number | null>(null)

  const activeBgm = bgms.find(b => b.id === activeBgmId) ?? bgms[bgms.length - 1] ?? null
  const durS      = (activeBgm?.duration_ms ?? 30000) / 1000

  // ── Document title ──────────────────────────────────────────────────────
  useEffect(() => {
    document.title = projectTitle ? `${projectTitle} | Sound` : "Sound | Director's Room"
  }, [projectTitle])

  // ── Boot — fetch project ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const { project } = await res.json()
        if (cancelled) return

        setProjectTitle(project.title ?? null)

        const existing: Bgm[] = project?.bgms ?? []
        if (existing.length > 0) {
          setBgms(existing)
          setActiveBgmId(existing[existing.length - 1].id)
          setPageState('ready')
        } else {
          setPageState('idle')
        }
      } catch (err) {
        if (cancelled) return
        setError(String(err))
        setPageState('error')
      }
    }
    boot()
    return () => { cancelled = true }
  }, [projectId])

  // ── Audio element management ────────────────────────────────────────────
  useEffect(() => {
    if (!activeBgm?.url) return

    // Tear down old audio element
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }

    const audio = new Audio()
    audio.src    = activeBgm.url
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    audioRef.current = audio

    const tick = () => {
      setTime(audio.currentTime)
      rafRef.current = requestAnimationFrame(tick)
    }

    audio.addEventListener('play',  () => { rafRef.current = requestAnimationFrame(tick) })
    audio.addEventListener('pause', () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) })
    audio.addEventListener('ended', () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setPlaying(false)
      setTime(0)
    })

    setPlaying(false)
    setTime(0)

    return () => {
      audio.pause()
      audio.src = ''
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [activeBgm?.url])

  // ── Playback controls ───────────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      audio.play().catch(console.error)
      setPlaying(true)
    }
  }, [playing])

  const handleSeek = useCallback((t: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = t
    setTime(t)
  }, [])

  // ── Generate ────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (isGenerating) return
    setIsGenerating(true)
    setError(null)
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
      const { bgms: newBgms } = await res.json()
      if (newBgms && newBgms.length > 0) {
        setBgms(prev => [...prev, ...newBgms])
        setActiveBgmId(newBgms[newBgms.length - 1].id)
        setApproved(false)
        setPageState('ready')
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsGenerating(false)
    }
  }, [projectId, isGenerating])

  const handlePick = useCallback((id: string) => {
    setActiveBgmId(id)
    setApproved(false)
    setPlaying(false)
    setTime(0)
  }, [])

  // ── Loading ──────────────────────────────────────────────────────────────
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

  // ── Generating full-screen animation ────────────────────────────────────
  if (pageState === 'generating') {
    const bars = Array.from({ length: 56 }, (_, i) => {
      const p = i / 55
      return Math.max(0.08, Math.sin(p * Math.PI) * 0.72 + Math.sin(p * 29) * 0.1 + 0.1)
    })
    return (
      <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
        <Sprocket />
        <TopBar breadcrumb={[{ label: 'Projects', href: '/' }, { label: 'Sound', current: true }]} />
        <WorkflowStepper current="sound" projectId={projectId} />
        <div className="flex-1 flex flex-col items-center justify-center gap-10">
          <div className="flex items-end gap-[3px]" style={{ height: 96 }}>
            {bars.map((h, i) => (
              <div
                key={i}
                className="breathe"
                style={{
                  width: '4px',
                  height: `${(h * 100).toFixed(2)}%`,
                  background: GOLD,
                  borderRadius: '2px',
                  opacity: 0.6,
                  animationDelay: `${i * 45}ms`,
                  animationDuration: `${(1.8 + (i % 4) * 0.3).toFixed(1)}s`,
                }}
              />
            ))}
          </div>
          <div className="text-center space-y-3">
            {projectTitle && (
              <p className="text-lg font-display font-light" style={{ color: 'var(--text-primary)' }}>
                {projectTitle}
              </p>
            )}
            <p className="text-sm font-light breathe" style={{ color: 'var(--text-secondary)' }}>
              Composing soundtrack…
            </p>
            <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
              ElevenLabs is scoring your teaser via Runway
            </p>
          </div>
        </div>
      </main>
    )
  }

  // ── Idle — no tracks yet ─────────────────────────────────────────────────
  if (pageState === 'idle') {
    return (
      <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
        <Sprocket />
        <TopBar
          breadcrumb={[{ label: 'Projects', href: '/' }, { label: 'Video', href: `/video/${projectId}` }, { label: 'Sound', current: true }]}
        />
        <WorkflowStepper current="sound" projectId={projectId} />
        <div className="flex-1 flex flex-col items-center justify-center gap-8"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(200,146,28,0.04) 0%, transparent 70%)' }}>
          <div
            className="w-16 h-16 rounded-full border flex items-center justify-center"
            style={{ borderColor: 'var(--border-emphasis)', background: 'rgba(255,255,255,0.03)' }}
          >
            <Volume2 className="w-7 h-7" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>No soundtrack yet</p>
            <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
              Generate a background music track for your teaser
            </p>
          </div>
          <Button
            variant="primary" size="md"
            onClick={() => { setPageState('generating'); generate() }}
            className="group gap-2"
          >
            Generate Soundtrack <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>
          {error && (
            <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
          )}
        </div>
        <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
          <div className="flex items-center py-4" style={{ maxWidth: 800, margin: '0 auto', paddingLeft: 40, paddingRight: 40 }}>
            <Button variant="secondary" size="sm" onClick={() => router.push(`/video/${projectId}`)}>
              <ArrowLeft className="w-3 h-3" /> Video
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
        <Sprocket />
        <TopBar breadcrumb={[{ label: 'Projects', href: '/' }, { label: 'Sound', current: true }]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded border"
            style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
            <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
            <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => generate()}>
            <RefreshCw className="w-3 h-3" /> Try again
          </Button>
        </div>
      </main>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  if (!activeBgm) return null

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Video',    href: `/video/${projectId}` },
          { label: 'Sound',    current: true },
        ]}
        rightAction={
          <Button
            variant="secondary" size="sm"
            onClick={generate}
            disabled={isGenerating}
          >
            {isGenerating
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
              : <><RefreshCw className="w-3 h-3" /> Generate new</>
            }
          </Button>
        }
      />

      <WorkflowStepper current="sound" projectId={projectId} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ maxWidth: 760, margin: '0 auto', paddingTop: 28, paddingBottom: 100, paddingLeft: 32, paddingRight: 32 }}>

          {/* Header */}
          <div className="flex items-end justify-between mb-5">
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Step 5 of 6
              </p>
              <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
                Sound Engineering
              </h1>
            </div>
            <span className="text-[10px] font-slate pb-1" style={{ color: 'var(--text-muted)' }}>
              {bgms.length} generation{bgms.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 rounded border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
              <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
              <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>{error}</p>
              <Button variant="tertiary" size="sm" onClick={() => setError(null)}>Dismiss</Button>
            </div>
          )}

          {/* Alternates strip */}
          <AlternatesStrip bgms={bgms} activeId={activeBgm.id} onPick={handlePick} />

          {/* Selected track banner */}
          <div
            className="rounded border p-4 mb-5"
            style={{ borderColor: GOLD, background: GOLD_DIM }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-semibold" style={{ color: GOLD_BRIGHT }}>
                    Track {bgms.findIndex(b => b.id === activeBgm.id) + 1}
                  </span>
                  {approved && (
                    <span
                      className="text-[8px] tracking-[0.1em] uppercase border rounded px-1.5 py-0.5"
                      style={{ color: GOLD, borderColor: GOLD }}
                    >
                      Approved
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-light leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {activeBgm.prompt}
                </p>
                <p className="text-[9px] mt-2 font-slate tracking-[0.07em]" style={{ color: 'var(--text-muted)' }}>
                  AUTO-GENERATED BY ARGON · prompt is read-only in v1
                </p>
              </div>
              <div className="text-right flex-none">
                <p className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                  {activeBgm.timestamps.length} shots
                </p>
                <p className="text-[10px] font-slate mt-1" style={{ color: 'var(--text-muted)' }}>
                  {fmt(durS)}
                </p>
              </div>
            </div>
          </div>

          {/* Playback bar */}
          <div
            className="flex items-center gap-3 py-3 mb-3 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {/* Play / Pause */}
            <button
              onClick={handlePlayPause}
              className="flex-none w-7 h-7 rounded-full border flex items-center justify-center transition-colors duration-150"
              style={{ borderColor: 'var(--border-standard)', background: 'none' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = GOLD }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-standard)' }}
            >
              {playing
                ? <Pause className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                : <Play  className="w-3 h-3 ml-0.5" style={{ color: 'var(--text-secondary)' }} />
              }
            </button>

            {/* Time */}
            <span className="flex-none text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)', minWidth: 72 }}>
              {fmt(time)} / {fmt(durS)}
            </span>

            {/* Scrubber */}
            <div
              className="flex-1 relative h-1 rounded-full cursor-pointer"
              style={{ background: 'var(--surface-3)' }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect()
                handleSeek(((e.clientX - rect.left) / rect.width) * durS)
              }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(time / durS) * 100}%`, background: GOLD }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                style={{
                  left: `${(time / durS) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  background: GOLD_BRIGHT,
                  boxShadow: `0 0 0 2px var(--canvas)`,
                }}
              />
            </div>
          </div>

          {/* Timeline caption */}
          <p className="text-[9px] font-slate tracking-[0.1em] mb-2" style={{ color: 'var(--text-muted)' }}>
            UNIFIED TIMELINE — click anywhere to seek · energy and volume are read-only
          </p>

          {/* Timeline SVG */}
          <div
            className="rounded border overflow-hidden"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--canvas)' }}
          >
            <TimelineSvg bgm={activeBgm} time={time} onSeek={handleSeek} />
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="secondary" size="sm"
              onClick={generate} disabled={isGenerating}
            >
              {isGenerating
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                : <>Generate another</>
              }
            </Button>

            <div className="flex items-center gap-3">
              {!approved ? (
                <Button
                  variant="primary" size="md"
                  onClick={() => setApproved(true)}
                  className="gap-2"
                >
                  <Check className="w-3 h-3" /> Approve track
                </Button>
              ) : (
                <Button
                  variant="primary" size="md"
                  onClick={() => router.push(`/export/${projectId}`)}
                  className="group gap-2"
                >
                  Export Video <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="flex-none w-full border-t"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
      >
        <div
          className="flex items-center justify-between py-4"
          style={{ maxWidth: 760, margin: '0 auto', paddingLeft: 32, paddingRight: 32 }}
        >
          <Button variant="secondary" size="sm" onClick={() => router.push(`/video/${projectId}`)}>
            <ArrowLeft className="w-3 h-3" /> Video
          </Button>
          {approved && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent-green)' }} />
              <span className="text-[10px] font-slate" style={{ color: 'var(--accent-green)' }}>
                Track approved — ready to export
              </span>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
