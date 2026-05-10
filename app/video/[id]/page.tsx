'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Film, Play, ArrowRight, ArrowLeft, Loader2, AlertCircle, RefreshCw, Clock } from 'lucide-react'
import type { VideoResult, VideoClip, StoryboardResult, StoryboardShot } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import WorkflowStepper from '@/components/WorkflowStepper'
import Button from '@/components/ui/Button'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActiveImageUrl(shot: StoryboardShot): string | null {
  const gens = shot.image?.generations
  if (!gens || gens.length === 0) return null
  const active = shot.image.active
  const gen = gens.find(g => g.version === active) ?? gens[gens.length - 1]
  return gen?.url ?? null
}

const TOTAL_S = 30

function sortKeys(keys: string[]) {
  return keys.sort((a, b) => {
    const [aS, aF] = a.split('.').map(Number)
    const [bS, bF] = b.split('.').map(Number)
    return aS !== bS ? aS - bS : aF - bF
  })
}

/** Derive display clips from storyboard shots when no video generated yet */
function deriveClips(storyboard: StoryboardResult): VideoClip[] {
  const keys = sortKeys(Object.keys(storyboard.shots))
  const base = Math.floor(TOTAL_S / Math.max(keys.length, 1))
  return keys.map((key, i) => ({
    shotKey: key,
    duration: i === keys.length - 1 ? Math.max(3, TOTAL_S - base * (keys.length - 1)) : base,
    status: 'pending' as const,
    prompt: storyboard.shots[key]?.script_data?.description ?? '',
    thumbnailUrl: getActiveImageUrl(storyboard.shots[key]) ?? undefined,
  }))
}

// ─── Compiled video player ────────────────────────────────────────────────────

function VideoPlayer({
  hasVideo,
  compiledUrl,
  isGenerating,
  onGenerate,
  totalDuration,
}: {
  hasVideo: boolean
  compiledUrl?: string
  isGenerating: boolean
  onGenerate: () => void
  totalDuration: number
}) {
  return (
    <div
      className="w-full rounded overflow-hidden border"
      style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
    >
      {/* Player area — 16:9 */}
      <div
        className="relative w-full"
        style={{ aspectRatio: '16/9', background: 'var(--canvas)' }}
      >
        {compiledUrl ? (
          <video
            src={compiledUrl}
            className="w-full h-full object-cover"
            controls
          />
        ) : (
          <>
            {/* Dark cinematic placeholder */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-6"
              style={{
                background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(170,136,68,0.04) 0%, transparent 70%)',
              }}
            >
              {/* Viewfinder corners */}
              <div className="absolute inset-8 pointer-events-none">
                {[
                  'top-0 left-0 border-t border-l',
                  'top-0 right-0 border-t border-r',
                  'bottom-0 left-0 border-b border-l',
                  'bottom-0 right-0 border-b border-r',
                ].map((cls, i) => (
                  <div
                    key={i}
                    className={`absolute w-6 h-6 ${cls}`}
                    style={{ borderColor: 'var(--border-emphasis)' }}
                  />
                ))}
              </div>

              {isGenerating ? (
                <div className="flex flex-col items-center gap-4">
                  <Loader2
                    className="w-8 h-8 animate-spin"
                    style={{ color: 'var(--text-tertiary)' }}
                  />
                  <p className="text-sm font-slate breathe" style={{ color: 'var(--text-secondary)' }}>
                    Generating video clips…
                  </p>
                  <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
                    This may take a few minutes
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-5 text-center">
                  <div
                    className="w-16 h-16 rounded-full border flex items-center justify-center"
                    style={{ borderColor: 'var(--border-emphasis)', background: 'rgba(255,255,255,0.03)' }}
                  >
                    <Play className="w-7 h-7 ml-0.5" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>
                      Compiled video will appear here
                    </p>
                    <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
                      {totalDuration}s · {Math.round(totalDuration / 3.5)} clips
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={onGenerate}
                    disabled={isGenerating}
                    className="group gap-2 mt-2"
                  >
                    Generate Video{' '}
                    <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Duration pill — bottom left */}
        {(hasVideo || isGenerating) && (
          <div
            className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded font-slate text-[10px]"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--text-secondary)' }}
          >
            <Clock className="w-3 h-3" />
            {totalDuration}s
          </div>
        )}
      </div>

      {/* Below player — status bar */}
      <div
        className="flex items-center justify-between px-5 py-3 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: hasVideo ? 'var(--accent-green)' : 'var(--text-muted)' }}
          />
          <span className="text-[10px] font-slate" style={{ color: hasVideo ? 'var(--accent-green)' : 'var(--text-muted)' }}>
            {hasVideo ? 'Video ready' : isGenerating ? 'Generating…' : 'Not yet generated'}
          </span>
        </div>
        {hasVideo && (
          <Button variant="secondary" size="sm" onClick={onGenerate}>
            <RefreshCw className="w-3 h-3" /> Regenerate
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Clip row ─────────────────────────────────────────────────────────────────

function ClipRow({
  clip,
  index,
  shot,
  isFirst,
}: {
  clip: VideoClip
  index: number
  shot?: StoryboardShot
  isFirst: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const thumbnail = clip.thumbnailUrl ?? (shot ? getActiveImageUrl(shot) : null)
  const isPending = clip.status === 'pending'
  const sd = shot?.script_data

  return (
    <div
      className="flex gap-5 py-5 transition-colors duration-150"
      style={{
        borderTop: isFirst ? 'none' : '1px solid var(--border-subtle)',
        background: hovered ? 'var(--surface-1)' : 'transparent',
        borderRadius: 4,
        padding: hovered ? '20px 16px' : '20px 0',
        margin: hovered ? '0 -16px' : '0',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Thumbnail ── */}
      <div
        className="relative flex-none rounded overflow-hidden"
        style={{
          width: 224,
          aspectRatio: '16/9',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-standard)',
          flexShrink: 0,
        }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={clip.shotKey}
            className="w-full h-full object-cover transition-transform duration-300"
            style={{
              transform: hovered ? 'scale(1.03)' : 'scale(1)',
              opacity: isPending ? 0.55 : 1,
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-6 h-6" style={{ color: 'var(--border-standard)' }} />
          </div>
        )}

        {/* Shimmer overlay when pending */}
        {isPending && (
          <div className="absolute inset-0 shimmer opacity-30" />
        )}

        {/* Play button on hover (ready clips only) */}
        {!isPending && hovered && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Clip index + shot key */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span
            className="text-[9px] font-slate px-1 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--text-muted)' }}
          >
            {index + 1}
          </span>
          <span
            className="text-[9px] font-slate px-1.5 py-0.5 rounded border"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--accent-amber)', borderColor: 'rgba(170,136,68,0.3)' }}
          >
            {clip.shotKey}
          </span>
        </div>

        {/* Duration badge */}
        <div
          className="absolute bottom-2 right-2 text-[9px] font-slate px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--text-secondary)' }}
        >
          {clip.duration}s
        </div>
      </div>

      {/* ── Details ── */}
      <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
        {/* Top: meta chips */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {/* Status chip */}
          <span
            className="text-[9px] font-slate px-2 py-0.5 rounded uppercase tracking-wide"
            style={{
              background: isPending ? 'rgba(255,255,255,0.04)' : 'rgba(90,138,90,0.08)',
              color: isPending ? 'var(--text-muted)' : 'var(--accent-green)',
              border: `1px solid ${isPending ? 'var(--border-subtle)' : 'rgba(90,138,90,0.2)'}`,
            }}
          >
            {isPending ? 'Pending' : 'Ready'}
          </span>

          {/* Framing */}
          {sd?.framing && (
            <span
              className="text-[9px] font-slate px-2 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}
            >
              {sd.framing}
            </span>
          )}

          {/* Time of day */}
          {sd?.time_of_day && (
            <span
              className="text-[9px] font-slate px-2 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}
            >
              {sd.time_of_day}
            </span>
          )}

          {/* Mood */}
          {sd?.mood && (
            <span
              className="text-[9px] font-slate px-2 py-0.5 rounded"
              style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}
            >
              {sd.mood}
            </span>
          )}
        </div>

        {/* Description */}
        <p
          className="text-sm font-light leading-relaxed mb-3"
          style={{ color: isPending ? 'var(--text-secondary)' : 'var(--text-primary)' }}
        >
          {clip.prompt || sd?.description || '—'}
        </p>

        {/* Camera movement + lighting */}
        <div className="flex flex-col gap-1">
          {sd?.camera_movement && (
            <p className="text-[11px] font-slate" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Camera</span> — {sd.camera_movement}
            </p>
          )}
          {sd?.lighting && (
            <p className="text-[11px] font-slate" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Lighting</span> — {sd.lighting}
            </p>
          )}
          {sd?.dialogue && sd.dialogue.length > 0 && (
            <p
              className="text-[11px] italic mt-1 pl-3 border-l"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
            >
              &ldquo;{sd.dialogue[0]}&rdquo;
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Session helpers ──────────────────────────────────────────────────────────

function readSessionStoryboard(): StoryboardResult | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-storyboard')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

function readSessionVideo(): VideoResult | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-video')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VideoPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null)
  const [video, setVideo] = useState<VideoResult | null>(null)
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'generating' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cachedStoryboard = readSessionStoryboard()
    const cachedVideo = readSessionVideo()

    if (cachedVideo && cachedVideo.projectId === projectId) {
      setVideo(cachedVideo)
      setStoryboard(cachedStoryboard)
      setPageState('ready')
      return
    }
    if (cachedStoryboard) {
      setStoryboard(cachedStoryboard)
      setPageState('ready')
      return
    }

    async function fetchFromAPI() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const { project } = await res.json()
        if (!project?.storyboard?.shots || Object.keys(project.storyboard.shots).length === 0) {
          router.push('/')
          return
        }
        setStoryboard({
          projectId: project.id,
          shots: project.storyboard.shots,
          activeGrid: project.storyboard.active_grid,
        })
        setPageState('ready')
      } catch {
        router.push('/')
      }
    }
    fetchFromAPI()
  }, [projectId, router])

  const handleGenerate = useCallback(async () => {
    if (!storyboard) return
    setError(null)
    setPageState('generating')
    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, shots: storyboard.shots }),
      })
      if (!res.ok) throw new Error('Video generation failed')
      const { video: result } = await res.json()
      sessionStorage.setItem('directors-room-video', JSON.stringify(result))
      setVideo(result)
      setPageState('ready')
    } catch (err) {
      setError(String(err))
      setPageState('ready')
    }
  }, [projectId, storyboard])

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
        <Sprocket />
        <TopBar breadcrumb={[{ label: 'Projects', href: '/' }, { label: 'Video', current: true }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>Loading project...</p>
          </div>
        </div>
      </main>
    )
  }

  const hasVideo = !!(video && video.status === 'ready')
  const isGenerating = pageState === 'generating'

  // Build the clip list to display — either generated clips or derived from storyboard
  const displayClips: VideoClip[] = hasVideo
    ? video!.clips
    : storyboard
      ? deriveClips(storyboard)
      : []

  const totalDuration = hasVideo
    ? video!.totalDuration
    : displayClips.reduce((s, c) => s + c.duration, 0)

  // ── Ready ────────────────────────────────────────────────────────────────────
  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Storyboard', href: `/storyboard/${projectId}` },
          { label: 'Video', current: true },
        ]}
      />

      <WorkflowStepper current="video" projectId={projectId} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ maxWidth: 960, margin: '0 auto', paddingTop: 36, paddingBottom: 100, paddingLeft: 40, paddingRight: 40 }}>

          {/* ── Page header ── */}
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Step 4 of 5
              </p>
              <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
                Video
              </h1>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <span className="text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {displayClips.length} clips · {totalDuration}s
              </span>
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div
              className="mb-6 rounded border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}
            >
              <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
              <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>{error}</p>
              <Button variant="tertiary" size="sm" onClick={() => setError(null)}>Dismiss</Button>
            </div>
          )}

          {/* ── Compiled video player ── */}
          <div className="mb-10">
            <VideoPlayer
              hasVideo={hasVideo}
              compiledUrl={video?.compiledUrl}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              totalDuration={totalDuration}
            />
          </div>

          {/* ── Clip list ── */}
          {displayClips.length > 0 && (
            <div>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-2">
                <p className="text-[10px] tracking-[0.25em] uppercase font-slate" style={{ color: 'var(--text-muted)' }}>
                  {hasVideo ? 'Clips' : 'Shots — pending generation'}
                </p>
                <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                  {displayClips.length}
                </span>
              </div>

              {/* Rows */}
              <div>
                {displayClips.map((clip, i) => (
                  <ClipRow
                    key={clip.shotKey}
                    clip={clip}
                    index={i}
                    shot={storyboard?.shots[clip.shotKey]}
                    isFirst={i === 0}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div
        className="flex-none w-full border-t"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
      >
        <div
          className="flex items-center justify-between py-4"
          style={{ maxWidth: 960, margin: '0 auto', paddingLeft: 40, paddingRight: 40 }}
        >
          <Button variant="secondary" size="sm" onClick={() => router.push(`/storyboard/${projectId}`)}>
            <ArrowLeft className="w-3 h-3" /> Storyboard
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(`/sound/${projectId}`)}
            disabled={!hasVideo}
            className="group gap-2"
          >
            Sound Engineering <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </main>
  )
}
