'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Play, ArrowRight, ArrowLeft, Loader2, Check,
  Download, AlertCircle, RefreshCw, Music, Volume2,
} from 'lucide-react'
import type { Bgm, BgmTimestamp } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import WorkflowStepper from '@/components/WorkflowStepper'
import Button from '@/components/ui/Button'

const NOTE_COLORS: Record<string, string> = {
  INTRO: 'rgba(170,136,68,0.35)',
  RISE:  'rgba(170,136,68,0.60)',
  PEAK:  'rgba(170,136,68,1.00)',
  FALL:  'rgba(170,136,68,0.50)',
  FADE:  'rgba(170,136,68,0.25)',
}
const NOTE_COLOR_DEFAULT = 'rgba(170,136,68,0.4)'

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

function BgmTrackCard({
  bgm, index, isSelected, isApproved, onSelect,
}: {
  bgm: Bgm
  index: number
  isSelected: boolean
  isApproved: boolean
  onSelect: () => void
}) {
  const durationSec = (bgm.duration_ms / 1000).toFixed(0)
  const waveformSeed = bgm.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded border transition-all duration-200"
      style={{
        borderColor: isSelected ? 'var(--accent-amber)' : 'var(--border-standard)',
        background: isSelected ? 'rgba(170,136,68,0.04)' : 'var(--surface-1)',
        boxShadow: isSelected ? '0 0 0 1px var(--accent-amber)' : 'none',
      }}
    >
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[9px] font-slate px-1.5 py-0.5 rounded border"
              style={{
                color: isSelected ? 'var(--accent-amber)' : 'var(--text-muted)',
                borderColor: isSelected ? 'rgba(170,136,68,0.4)' : 'var(--border-subtle)',
                background: isSelected ? 'rgba(170,136,68,0.08)' : 'transparent',
              }}
            >
              Track {index + 1}
            </span>
            {isApproved && isSelected && (
              <span className="flex items-center gap-1 text-[9px] font-slate"
                style={{ color: 'var(--accent-green)' }}>
                <Check className="w-2.5 h-2.5" /> Approved
              </span>
            )}
          </div>
          <span className="text-[10px] font-slate tabular-nums"
            style={{ color: 'var(--text-muted)' }}>
            {durationSec}s
          </span>
        </div>

        <div className="mb-2">
          <Waveform seed={waveformSeed} animate={isSelected} height={28} />
        </div>

        <p className="text-[11px] font-light leading-relaxed italic"
          style={{ color: 'var(--text-muted)' }}>
          {bgm.prompt}
        </p>

        {bgm.timestamps.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[9px] font-slate" style={{ color: 'var(--text-muted)' }}>
              {bgm.timestamps.length} shots
            </span>
            <span style={{ color: 'var(--border-subtle)' }}>·</span>
            <span className="text-[9px] font-slate" style={{ color: 'var(--text-muted)' }}>
              Peak at {bgm.timestamps.find(t => t.dynamic_note === 'PEAK')?.shot_id ?? '—'}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

function BgmDetailView({
  bgm, videoThumbnail, approved, onApprove, onRegenerate,
}: {
  bgm: Bgm
  videoThumbnail: string | null
  approved: boolean
  onApprove: () => void
  onRegenerate: () => void
}) {
  const durationSec = (bgm.duration_ms / 1000).toFixed(0)

  return (
    <div className="space-y-6">

      <div className="rounded border overflow-hidden"
        style={{ borderColor: 'var(--border-standard)', background: 'var(--canvas)' }}>
        <div className="relative w-full" style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}>
          {videoThumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={videoThumbnail} alt="Preview"
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

      <div className="space-y-3">
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

      {bgm.timestamps.length > 0 && (
        <div>
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

function getFirstVideoThumbnail(shots: Record<string, { image?: { active: number; generations: { url: string; version: number }[] } }>): string | null {
  const keys = Object.keys(shots).sort((a, b) => {
    const [aS, aF] = a.split('.').map(Number)
    const [bS, bF] = b.split('.').map(Number)
    return aS !== bS ? aS - bS : aF - bF
  })
  for (const key of keys) {
    const shot = shots[key]
    const img = shot?.image
    const gens = img?.generations
    if (gens && gens.length > 0) {
      const active = img.active
      const gen = gens.find(g => g.version === active) ?? gens[gens.length - 1]
      if (gen?.url) return gen.url
    }
  }
  return null
}

type PageState = 'loading' | 'idle' | 'generating' | 'ready' | 'error'

export default function SoundPage() {
  const router    = useRouter()
  const params    = useParams()
  const projectId = params?.id as string

  const [projectTitle,   setProjectTitle]   = useState<string | null>(null)
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [bgms,           setBgms]           = useState<Bgm[]>([])
  const [activeBgmId,    setActiveBgmId]    = useState<string | null>(null)
  const [pageState,      setPageState]      = useState<PageState>('loading')
  const [error,          setError]          = useState<string | null>(null)
  const [approved,       setApproved]       = useState(false)
  const [isGenerating,   setIsGenerating]   = useState(false)

  const activeBgm = bgms.find(b => b.id === activeBgmId) ?? bgms[bgms.length - 1] ?? null

  useEffect(() => {
    if (projectTitle) {
      document.title = `${projectTitle} | Sound`
    } else {
      document.title = "Sound | Director's Room"
    }
  }, [projectTitle])

  // ── Generate (sync API) ──────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (isGenerating) return
    setIsGenerating(true)
    setError(null)
    setPageState(prev => bgms.length > 0 ? prev : 'generating')
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
      }
      setPageState('ready')
    } catch (err) {
      console.error('[sound] generate failed:', err)
      setError(String(err))
      setPageState(bgms.length > 0 ? 'ready' : 'error')
    } finally {
      setIsGenerating(false)
    }
  }, [projectId, bgms.length, isGenerating])

  // ── Boot — fetch project, check for existing BGMs ─────────────────────────
  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const { project } = await res.json()
        if (cancelled) return

        setProjectTitle(project.title ?? null)
        if (project?.storyboard?.shots) {
          setVideoThumbnail(getFirstVideoThumbnail(project.storyboard.shots))
        }

        const existingBgms: Bgm[] = project?.bgms ?? []
        if (existingBgms.length > 0) {
          setBgms(existingBgms)
          setActiveBgmId(existingBgms[existingBgms.length - 1].id)
          setPageState('ready')
          return
        }

        setPageState('idle')
      } catch (err) {
        if (cancelled) return
        console.error('[sound] Boot fetch failed:', err)
        setError(String(err))
        setPageState('error')
      }
    }

    boot()
    return () => { cancelled = true }
  }, [projectId])

  const handleApprove = useCallback(() => setApproved(true), [])

  const handleRegenerate = useCallback(() => {
    setApproved(false)
    generate()
  }, [generate])

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
        rightAction={pageState !== 'loading' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={generate}
            disabled={isGenerating}
          >
            {isGenerating
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
              : <><RefreshCw className="w-3 h-3" /> Generate New</>
            }
          </Button>
        )}
      />

      <WorkflowStepper current="sound" projectId={projectId} />

      {/* Loading */}
      {pageState === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="h-8 w-8 rounded-full border-t animate-spin"
            style={{ borderColor: 'var(--surface-2)', borderTopColor: 'var(--text-secondary)' }} />
          <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>Loading project...</p>
        </div>
      )}

      {/* Idle — no tracks yet */}
      {pageState === 'idle' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-8"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(170,136,68,0.04) 0%, transparent 70%)' }}>
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
          <Button variant="primary" size="md" onClick={generate} className="group gap-2">
            Generate Soundtrack <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>
        </div>
      )}

      {/* Generating (full page, only when no existing tracks) */}
      {pageState === 'generating' && bgms.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-10">
          <div className="flex items-end gap-[3px]" style={{ height: 96 }}>
            {generateWaveform(42, 56).map((h, i) => (
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
      )}

      {/* Error */}
      {pageState === 'error' && bgms.length === 0 && (
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

      {/* Ready — track list + detail */}
      {pageState === 'ready' && bgms.length > 0 && (
        <div className="flex-1 overflow-y-auto w-full">
          <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 32, paddingBottom: 100, paddingLeft: 40, paddingRight: 40 }}>

            <div className="mb-6">
              <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-1.5"
                style={{ color: 'var(--text-muted)' }}>Step 5 of 5</p>
              <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
                Sound Engineering
              </h1>
            </div>

            {error && (
              <div className="mb-6 rounded border px-4 py-3 flex items-center gap-3"
                style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
                <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
                <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>{error}</p>
                <Button variant="tertiary" size="sm" onClick={() => setError(null)}>Dismiss</Button>
              </div>
            )}

            {bgms.length > 1 && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-[10px] tracking-[0.25em] uppercase font-slate"
                    style={{ color: 'var(--text-muted)' }}>
                    Tracks
                  </p>
                  <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                  <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                    {bgms.length} generation{bgms.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid gap-3"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                  {bgms.map((b, i) => (
                    <BgmTrackCard
                      key={b.id}
                      bgm={b}
                      index={i}
                      isSelected={b.id === activeBgmId}
                      isApproved={approved}
                      onSelect={() => { setActiveBgmId(b.id); setApproved(false) }}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeBgm && (
              <BgmDetailView
                bgm={activeBgm}
                videoThumbnail={videoThumbnail}
                approved={approved}
                onApprove={handleApprove}
                onRegenerate={handleRegenerate}
              />
            )}
          </div>
        </div>
      )}

      {/* Bottom bar */}
      {(pageState === 'idle' || pageState === 'ready' || pageState === 'error') && (
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
