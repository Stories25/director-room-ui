'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import fixWebmDuration from 'fix-webm-duration'
import { useRouter, useParams } from 'next/navigation'
import {
  Play, Download, ArrowLeft, Loader2,
  AlertCircle, Volume2, Film, Music, Settings2,
} from 'lucide-react'
import type { Bgm, StoryboardResult, StoryboardShot, VideoClip } from '@/lib/types'
import { isVideoAll } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import WorkflowStepper from '@/components/WorkflowStepper'
import Button from '@/components/ui/Button'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOTAL_S = 30

function sortKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const [aS, aF] = a.split('.').map(Number)
    const [bS, bF] = b.split('.').map(Number)
    return aS !== bS ? aS - bS : aF - bF
  })
}

function getActiveImageUrl(shot: StoryboardShot): string | null {
  const gens = shot.image?.generations
  if (!gens || gens.length === 0) return null
  const active = shot.image.active
  const gen = gens.find(g => g.version === active) ?? gens[gens.length - 1]
  return gen?.url ?? null
}

function deriveClips(storyboard: StoryboardResult): VideoClip[] {
  const keys = sortKeys(Object.keys(storyboard.shots))
  const base = Math.floor(TOTAL_S / Math.max(keys.length, 1))
  return keys.map((key, i) => {
    const shot = storyboard.shots[key]
    const videoGen = shot.video?.generations?.[shot.video.generations.length - 1]
    return {
      shotKey: key,
      duration: i === keys.length - 1 ? Math.max(3, TOTAL_S - base * (keys.length - 1)) : base,
      status: videoGen?.status === 'succeeded' ? 'ready' : videoGen?.status === 'failed' ? 'error' : videoGen ? 'generating' : 'pending',
      prompt: shot?.script_data?.description ?? '',
      thumbnailUrl: getActiveImageUrl(shot) ?? undefined,
      url: videoGen?.status === 'succeeded' ? videoGen.url : undefined,
    }
  })
}

// ─── Gain Slider ─────────────────────────────────────────────────────────────

function GainSlider({
  label,
  icon,
  value,
  onChange,
  color,
}: {
  label: string
  icon: React.ReactNode
  value: number
  onChange: (v: number) => void
  color: string
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span style={{ color, opacity: 0.8 }} className="flex-none">{icon}</span>
      <span
        className="text-[10px] tracking-[0.12em] uppercase font-slate flex-none"
        style={{ color: 'var(--text-muted)', width: 80 }}
      >
        {label}
      </span>
      <div className="flex-1 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(value * 100)}
          onChange={e => onChange(Number(e.target.value) / 100)}
          className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
          style={{
            accentColor: color,
            background: `linear-gradient(to right, ${color} ${value * 100}%, var(--surface-3) ${value * 100}%)`,
          }}
        />
        <span
          className="text-[10px] font-slate tabular-nums flex-none"
          style={{ color: 'var(--text-muted)', width: 32, textAlign: 'right' }}
        >
          {Math.round(value * 100)}%
        </span>
      </div>
    </div>
  )
}

// ─── BGM Track Picker ────────────────────────────────────────────────────────

function BgmPicker({
  bgms,
  activeId,
  onSelect,
}: {
  bgms: Bgm[]
  activeId: string | null
  onSelect: (id: string) => void
}) {
  if (bgms.length <= 1) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[10px] tracking-[0.25em] uppercase font-slate" style={{ color: 'var(--text-muted)' }}>
          Background Music
        </p>
        <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
          {bgms.length} tracks
        </span>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {bgms.map((b, i) => {
          const isSelected = b.id === activeId
          return (
            <button
              key={b.id}
              onClick={() => onSelect(b.id)}
              className="text-left rounded border px-3 py-2 transition-all duration-150"
              style={{
                borderColor: isSelected ? 'var(--accent-amber)' : 'var(--border-standard)',
                background: isSelected ? 'rgba(170,136,68,0.06)' : 'var(--surface-1)',
                boxShadow: isSelected ? '0 0 0 1px var(--accent-amber)' : 'none',
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className="text-[9px] font-slate px-1.5 py-0.5 rounded border"
                  style={{
                    color: isSelected ? 'var(--accent-amber)' : 'var(--text-muted)',
                    borderColor: isSelected ? 'rgba(170,136,68,0.4)' : 'var(--border-subtle)',
                  }}
                >
                  Track {i + 1}
                </span>
                <span className="text-[9px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {(b.duration_ms / 1000).toFixed(0)}s
                </span>
              </div>
              <p className="text-[10px] font-light leading-relaxed italic truncate" style={{ color: 'var(--text-muted)' }}>
                {b.prompt}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Export Page ──────────────────────────────────────────────────────────────

type RenderState = 'idle' | 'rendering' | 'ready' | 'error'
type PageState = 'loading' | 'ready' | 'error'

export default function ExportPage() {
  const router    = useRouter()
  const params    = useParams()
  const projectId = params?.id as string

  const [projectTitle, setProjectTitle]   = useState<string | null>(null)
  const [storyboard, setStoryboard]       = useState<StoryboardResult | null>(null)
  const [bgms, setBgms]                   = useState<Bgm[]>([])
  const [activeBgmId, setActiveBgmId]     = useState<string | null>(null)
  const [pageState, setPageState]         = useState<PageState>('loading')
  const [pageError, setPageError]         = useState<string | null>(null)

  const [renderState, setRenderState]     = useState<RenderState>('idle')
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderClipIdx, setRenderClipIdx] = useState(0)
  const [renderError, setRenderError]     = useState<string | null>(null)
  const [blobUrl, setBlobUrl]             = useState<string | null>(null)

  const [bgmVolume, setBgmVolume]         = useState(0.7)
  const [videoVolume, setVideoVolume]     = useState(1.0)

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const blobUrlRef  = useRef<string | null>(null)
  const mountedRef  = useRef(true)

  const activeBgm = bgms.find(b => b.id === activeBgmId) ?? bgms[0] ?? null

  useEffect(() => {
    document.title = projectTitle ? `${projectTitle} | Export` : "Export | Director's Room"
  }, [projectTitle])

  useEffect(() => {
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }
  }, [])

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true

    async function boot() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const { project } = await res.json()
        if (!mountedRef.current) return

        setProjectTitle(project.title ?? null)

        if (!project?.storyboard?.shots || Object.keys(project.storyboard.shots).length === 0) {
          if (mountedRef.current) router.push(`/video/${projectId}`)
          return
        }

        const sb: StoryboardResult = {
          projectId: project.id,
          projectTitle: project.title,
          shots: project.storyboard.shots,
          activeGrid: project.storyboard.active_grid,
        }
        setStoryboard(sb)

        if (!isVideoAll(sb.shots)) {
          if (mountedRef.current) router.push(`/video/${projectId}`)
          return
        }

        const existingBgms: Bgm[] = project?.bgms ?? []
        if (existingBgms.length > 0) {
          setBgms(existingBgms)
          setActiveBgmId(existingBgms[existingBgms.length - 1].id)
        }

        setPageState('ready')
      } catch (err) {
        if (!mountedRef.current) return
        console.error('[export] Boot failed:', err)
        setPageError(String(err))
        setPageState('error')
      }
    }

    boot()
    return () => { mountedRef.current = false }
  }, [projectId, router])

  // ── Render (stitch video + BGM) ──────────────────────────────────────────
  const handleRender = useCallback(async () => {
    if (!storyboard || !canvasRef.current) return
    const clips = deriveClips(storyboard)
    const readyClips = clips.filter(c => c.status === 'ready' && c.url)
    if (readyClips.length === 0) return

    setRenderState('rendering')
    setRenderProgress(0)
    setRenderClipIdx(0)
    setRenderError(null)

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
      setBlobUrl(null)
    }

    try {
      const canvas = canvasRef.current
      canvas.width = 1280
      canvas.height = 720
      const ctx = canvas.getContext('2d')!

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'

      const audioCtx = new AudioContext()
      const audioDest = audioCtx.createMediaStreamDestination()

      const videoGainNode = audioCtx.createGain()
      videoGainNode.gain.value = videoVolume
      videoGainNode.connect(audioDest)

      const bgmGainNode = audioCtx.createGain()
      bgmGainNode.gain.value = bgmVolume
      bgmGainNode.connect(audioDest)

      // Set up BGM if available
      let bgmAudio: HTMLAudioElement | null = null
      if (activeBgm?.url) {
        bgmAudio = new Audio()
        bgmAudio.src = activeBgm.url
        bgmAudio.crossOrigin = 'anonymous'
        bgmAudio.loop = false
        bgmAudio.preload = 'auto'
        const bgmSource = audioCtx.createMediaElementSource(bgmAudio)
        bgmSource.connect(bgmGainNode)
      }

      const chunks: Blob[] = []
      const videoStream = canvas.captureStream(30)
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ])

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      })
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

      const startTime = Date.now()
      recorder.start(100)

      // Start BGM playback
      if (bgmAudio) {
        await bgmAudio.play().catch(err => console.warn('[export] BGM play failed:', err))
      }

      // Play each clip sequentially
      for (let i = 0; i < readyClips.length; i++) {
        if (!mountedRef.current) break
        setRenderClipIdx(i)

        const clip = readyClips[i]

        await new Promise<void>((resolve, reject) => {
          const vid = document.createElement('video')
          vid.src = clip.url!
          vid.crossOrigin = 'anonymous'
          vid.muted = false
          vid.playsInline = true
          vid.preload = 'auto'

          const source = audioCtx.createMediaElementSource(vid)
          source.connect(videoGainNode)

          vid.onloadeddata = () => {
            vid.play().catch(reject)
          }
          vid.onerror = () => reject(new Error(`Failed to load clip ${clip.shotKey}`))

          let rafId: number
          const drawFrame = () => {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
            if (!vid.ended && !vid.paused) {
              rafId = requestAnimationFrame(drawFrame)
            }
          }

          vid.onplay = () => { rafId = requestAnimationFrame(drawFrame) }

          vid.onended = () => {
            cancelAnimationFrame(rafId)
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
            source.disconnect()
            setRenderProgress(Math.round(((i + 1) / readyClips.length) * 100))
            resolve()
          }
        })
      }

      // Stop BGM
      if (bgmAudio) {
        bgmAudio.pause()
        bgmAudio.src = ''
      }

      audioCtx.close()

      const durationMs = Date.now() - startTime
      recorder.stop()
      await new Promise<void>(resolve => { recorder.onstop = () => resolve() })

      const rawBlob = new Blob(chunks, { type: mimeType })
      const fixedBlob = await fixWebmDuration(rawBlob, durationMs, { logger: false })

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const url = URL.createObjectURL(fixedBlob)
      blobUrlRef.current = url
      setBlobUrl(url)
      setRenderState('ready')
    } catch (err) {
      console.error('[export] Render failed:', err)
      setRenderError(String(err))
      setRenderState('error')
    }
  }, [storyboard, activeBgm, bgmVolume, videoVolume])

  const handleRetry = useCallback(() => {
    setRenderState('idle')
    setRenderError(null)
  }, [])

  const displayClips = storyboard ? deriveClips(storyboard) : []
  const readyClipCount = displayClips.filter(c => c.status === 'ready' && c.url).length
  const totalDuration = displayClips.reduce((s, c) => s + c.duration, 0) || TOTAL_S
  const filename = `${projectTitle || 'teaser'}.webm`

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageState === 'loading') {
    return (
      <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
        <Sprocket />
        <TopBar breadcrumb={[{ label: 'Projects', href: '/' }, { label: 'Export', current: true }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>Loading project...</p>
          </div>
        </div>
      </main>
    )
  }

  // ── Page error ───────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
        <Sprocket />
        <TopBar breadcrumb={[{ label: 'Projects', href: '/' }, { label: 'Export', current: true }]} />
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <AlertCircle className="w-8 h-8" style={{ color: 'var(--accent-red)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{pageError}</p>
          <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="w-3 h-3" /> Back to Projects
          </Button>
        </div>
      </main>
    )
  }

  // ── Main content ─────────────────────────────────────────────────────────
  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Sound', href: `/sound/${projectId}` },
          { label: 'Export', current: true },
        ]}
      />

      <WorkflowStepper current="export" projectId={projectId} />

      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ maxWidth: 800, margin: '0 auto', paddingTop: 32, paddingBottom: 120, paddingLeft: 40, paddingRight: 40 }}>

          {/* Header */}
          <div className="mb-8">
            <p className="text-[10px] tracking-[0.25em] uppercase font-slate mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Step 6 of 6
            </p>
            <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
              Final Export
            </h1>
            <p className="text-xs font-slate mt-1" style={{ color: 'var(--text-muted)' }}>
              Stitch your video clips with the soundtrack and download
            </p>
          </div>

          {/* BGM Picker */}
          {bgms.length > 1 && (
            <BgmPicker bgms={bgms} activeId={activeBgmId} onSelect={id => { setActiveBgmId(id); setRenderState('idle') }} />
          )}

          {/* Audio Mix Panel */}
          <div className="mb-8 rounded border" style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}>
            <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
              <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
              <span className="text-[10px] tracking-[0.2em] uppercase font-slate" style={{ color: 'var(--text-muted)' }}>
                Audio Mix
              </span>
            </div>
            <div className="px-5 py-2">
              <GainSlider
                label="Video Audio"
                icon={<Film className="w-3.5 h-3.5" />}
                value={videoVolume}
                onChange={v => { setVideoVolume(v); if (renderState === 'ready') setRenderState('idle') }}
                color="var(--text-secondary)"
              />
              <GainSlider
                label="BGM"
                icon={<Music className="w-3.5 h-3.5" />}
                value={bgmVolume}
                onChange={v => { setBgmVolume(v); if (renderState === 'ready') setRenderState('idle') }}
                color="var(--accent-amber)"
              />
            </div>
          </div>

          {/* Preview / Player */}
          <div className="rounded border overflow-hidden mb-8" style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}>
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <div className="relative w-full" style={{ aspectRatio: '16/9', background: 'var(--canvas)' }}>
              {/* Rendered video playing */}
              {renderState === 'ready' && blobUrl && (
                <video src={blobUrl} className="w-full h-full object-cover" controls autoPlay />
              )}

              {/* Rendering progress */}
              {renderState === 'rendering' && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-6"
                  style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(170,136,68,0.04) 0%, transparent 70%)' }}
                >
                  {/* Viewfinder corners */}
                  <div className="absolute inset-8 pointer-events-none">
                    {['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r',
                      'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((cls, i) => (
                      <div key={i} className={`absolute w-6 h-6 ${cls}`} style={{ borderColor: 'var(--border-emphasis)' }} />
                    ))}
                  </div>

                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-amber)' }} />
                  <div className="w-64 space-y-2">
                    <p className="text-sm font-light text-center" style={{ color: 'var(--text-secondary)' }}>
                      Rendering clip {renderClipIdx + 1} of {readyClipCount}…
                    </p>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${renderProgress}%`, background: 'var(--accent-amber)' }}
                      />
                    </div>
                    <p className="text-[10px] font-slate text-center" style={{ color: 'var(--text-muted)' }}>
                      {renderProgress}% — processing in real time
                    </p>
                  </div>
                </div>
              )}

              {/* Render error */}
              {renderState === 'error' && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-5"
                  style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(170,136,68,0.04) 0%, transparent 70%)' }}
                >
                  <AlertCircle className="w-8 h-8" style={{ color: 'var(--accent-red)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Render failed</p>
                  <p className="text-[10px] max-w-xs text-center" style={{ color: 'var(--text-muted)' }}>{renderError}</p>
                  <Button variant="secondary" size="sm" onClick={handleRetry}>Retry</Button>
                </div>
              )}

              {/* Idle — ready to render */}
              {renderState === 'idle' && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-6"
                  style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(170,136,68,0.04) 0%, transparent 70%)' }}
                >
                  {/* Viewfinder corners */}
                  <div className="absolute inset-8 pointer-events-none">
                    {['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r',
                      'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((cls, i) => (
                      <div key={i} className={`absolute w-6 h-6 ${cls}`} style={{ borderColor: 'var(--border-emphasis)' }} />
                    ))}
                  </div>

                  <button
                    onClick={handleRender}
                    className="w-16 h-16 rounded-full border flex items-center justify-center cursor-pointer group"
                    style={{ borderColor: 'var(--accent-amber)', background: 'rgba(170,136,68,0.1)' }}
                  >
                    <Play className="w-7 h-7 ml-0.5 transition-transform duration-200 group-hover:scale-110" style={{ color: 'var(--accent-amber)' }} />
                  </button>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-light" style={{ color: 'var(--text-primary)' }}>
                      {readyClipCount} clips · {activeBgm ? 'with soundtrack' : 'video only'}
                    </p>
                    <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
                      Click to render final video
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full" style={{
                  background: renderState === 'ready' ? 'var(--accent-green)'
                    : renderState === 'rendering' ? 'var(--accent-amber)'
                    : 'var(--text-muted)',
                }} />
                <span className="text-[10px] font-slate" style={{
                  color: renderState === 'ready' ? 'var(--accent-green)'
                    : renderState === 'rendering' ? 'var(--accent-amber)'
                    : 'var(--text-muted)',
                }}>
                  {renderState === 'ready' ? 'Ready to download'
                    : renderState === 'rendering' ? `Rendering… ${renderProgress}%`
                    : 'Not yet rendered'}
                </span>
              </div>
              <span className="text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {totalDuration}s · WebM
              </span>
            </div>
          </div>

          {/* Download section */}
          {renderState === 'ready' && blobUrl && (
            <div className="rounded border p-6 text-center" style={{ borderColor: 'var(--accent-amber)', background: 'rgba(170,136,68,0.04)' }}>
              <p className="text-sm font-light mb-1" style={{ color: 'var(--text-primary)' }}>
                Your teaser is ready
              </p>
              <p className="text-[10px] font-slate mb-4" style={{ color: 'var(--text-muted)' }}>
                {totalDuration}s · WebM format · {readyClipCount} clips{activeBgm ? ' · soundtrack' : ''}
              </p>
              <a href={blobUrl} download={filename} target="_blank" rel="noopener noreferrer">
                <Button variant="primary" size="lg" className="gap-2">
                  <Download className="w-4 h-4" /> Download Video
                </Button>
              </a>
              <p className="text-[9px] font-slate mt-3" style={{ color: 'var(--text-muted)' }}>
                WebM is compatible with Chrome, Firefox, and Edge
              </p>
            </div>
          )}

          {/* No BGM notice */}
          {!activeBgm && renderState === 'idle' && (
            <div className="rounded border px-4 py-3 flex items-center gap-3" style={{ borderColor: 'rgba(170,136,68,0.2)', background: 'rgba(170,136,68,0.04)' }}>
              <Volume2 className="w-4 h-4 flex-none" style={{ color: 'var(--accent-amber)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No soundtrack selected — export will be video only.{' '}
                <button onClick={() => router.push(`/sound/${projectId}`)} className="underline" style={{ color: 'var(--accent-amber)' }}>
                  Add soundtrack
                </button>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="flex-none w-full border-t"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
      >
        <div
          className="flex items-center justify-between py-4"
          style={{ maxWidth: 800, margin: '0 auto', paddingLeft: 40, paddingRight: 40 }}
        >
          <Button variant="secondary" size="sm" onClick={() => router.push(`/sound/${projectId}`)}>
            <ArrowLeft className="w-3 h-3" /> Sound
          </Button>
          {renderState === 'ready' && blobUrl && (
            <a href={blobUrl} download={filename} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" size="md" className="gap-2">
                <Download className="w-3 h-3" /> Download
              </Button>
            </a>
          )}
        </div>
      </div>
    </main>
  )
}
