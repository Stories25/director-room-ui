'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import fixWebmDuration from 'fix-webm-duration'
import { useRouter, useParams } from 'next/navigation'
import {
  Play, Pause, Download, ArrowLeft, Loader2,
  AlertCircle, Volume2, Film, Music, Settings2, RefreshCw,
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
      status: videoGen?.status === 'succeeded' ? 'ready'
        : videoGen?.status === 'failed' ? 'error'
        : videoGen ? 'generating' : 'pending',
      prompt: shot?.script_data?.description ?? '',
      thumbnailUrl: getActiveImageUrl(shot) ?? undefined,
      url: videoGen?.status === 'succeeded' ? videoGen.url : undefined,
    }
  })
}

// ─── Gain Slider ─────────────────────────────────────────────────────────────

function GainSlider({
  label, icon, value, onChange, color, disabled,
}: {
  label: string
  icon: React.ReactNode
  value: number
  onChange: (v: number) => void
  color: string
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-3 py-2.5" style={{ opacity: disabled ? 0.45 : 1 }}>
      <span style={{ color, opacity: 0.8 }} className="flex-none">{icon}</span>
      <span
        className="text-[10px] tracking-[0.12em] uppercase font-slate flex-none"
        style={{ color: 'var(--text-muted)', width: 90 }}
      >
        {label}
      </span>
      <div className="flex-1 flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(value * 100)}
          onChange={e => !disabled && onChange(Number(e.target.value) / 100)}
          disabled={disabled}
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

// ─── BGM Picker ──────────────────────────────────────────────────────────────

function BgmPicker({ bgms, activeId, onSelect }: {
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
        <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>{bgms.length} tracks</span>
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
                <span className="text-[9px] font-slate px-1.5 py-0.5 rounded border" style={{
                  color: isSelected ? 'var(--accent-amber)' : 'var(--text-muted)',
                  borderColor: isSelected ? 'rgba(170,136,68,0.4)' : 'var(--border-subtle)',
                }}>
                  Track {i + 1}
                </span>
                <span className="text-[9px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {(b.duration_ms / 1000).toFixed(0)}s
                </span>
              </div>
              <p className="text-[10px] font-light italic truncate" style={{ color: 'var(--text-muted)' }}>
                {b.prompt}
              </p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type StitchState = 'idle' | 'stitching' | 'ready' | 'error'
type ExportState = 'idle' | 'converting' | 'done' | 'error'
type PageState  = 'loading' | 'ready' | 'error'

// ─── Export Page ──────────────────────────────────────────────────────────────

export default function ExportPage() {
  const router    = useRouter()
  const params    = useParams()
  const projectId = params?.id as string

  // ── Project data
  const [projectTitle, setProjectTitle] = useState<string | null>(null)
  const [storyboard,   setStoryboard]   = useState<StoryboardResult | null>(null)
  const [bgms,         setBgms]         = useState<Bgm[]>([])
  const [activeBgmId,  setActiveBgmId]  = useState<string | null>(null)
  const [pageState,    setPageState]    = useState<PageState>('loading')
  const [pageError,    setPageError]    = useState<string | null>(null)

  // ── Phase 1: Stitch (video-only blob, no BGM baked in)
  const [stitchState,    setStitchState]    = useState<StitchState>('idle')
  const [stitchProgress, setStitchProgress] = useState(0)
  const [stitchClipIdx,  setStitchClipIdx]  = useState(0)
  const [stitchError,    setStitchError]    = useState<string | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)

  // ── Phase 2: Live preview mix (AudioContext gain nodes)
  const [bgmVolume,    setBgmVolume]    = useState(0.7)
  const [videoVolume,  setVideoVolume]  = useState(1.0)
  const [isPlaying,    setIsPlaying]    = useState(false)

  // ── Phase 3: Export → MP4
  const [exportState,    setExportState]    = useState<ExportState>('idle')
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError,    setExportError]    = useState<string | null>(null)
  const [mp4Url,         setMp4Url]         = useState<string | null>(null)

  // ── Refs
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const videoRef        = useRef<HTMLVideoElement | null>(null)
  const bgmRef          = useRef<HTMLAudioElement>(null)
  const audioCtxRef     = useRef<AudioContext | null>(null)
  const videoGainRef    = useRef<GainNode | null>(null)
  const bgmGainRef      = useRef<GainNode | null>(null)
  const previewBlobRef  = useRef<string | null>(null)
  const mp4BlobRef      = useRef<string | null>(null)
  const mountedRef      = useRef(true)
  // Track which elements have already been claimed by createMediaElementSource —
  // the Web Audio API only allows each HTMLMediaElement to be sourced once per lifetime.
  const sourcedElements = useRef(new WeakSet<HTMLMediaElement>())

  const activeBgm = bgms.find(b => b.id === activeBgmId) ?? bgms[0] ?? null

  // ── Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current)
      if (mp4BlobRef.current) URL.revokeObjectURL(mp4BlobRef.current)
      audioCtxRef.current?.close()
    }
  }, [])

  useEffect(() => {
    document.title = projectTitle ? `${projectTitle} | Export` : "Export | Director's Room"
  }, [projectTitle])

  // ── Boot: load project
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
          router.push(`/video/${projectId}`); return
        }

        const sb: StoryboardResult = {
          projectId: project.id,
          projectTitle: project.title,
          shots: project.storyboard.shots,
          activeGrid: project.storyboard.active_grid,
        }
        setStoryboard(sb)

        if (!isVideoAll(sb.shots)) {
          router.push(`/video/${projectId}`); return
        }

        const existingBgms: Bgm[] = project?.bgms ?? []
        if (existingBgms.length > 0) {
          setBgms(existingBgms)
          setActiveBgmId(existingBgms[existingBgms.length - 1].id)
        }

        setPageState('ready')
      } catch (err) {
        if (!mountedRef.current) return
        setPageError(String(err))
        setPageState('error')
      }
    }
    boot()
    return () => { mountedRef.current = false }
  }, [projectId, router])

  // ── Wire up AudioContext for live preview when preview blob is ready
  const setupAudioContext = useCallback(() => {
    const videoEl = videoRef.current
    const bgmEl   = bgmRef.current
    if (!videoEl) return

    // If we already have a live context and both elements are already sourced,
    // there's nothing to do — just resume if suspended.
    const existingCtx = audioCtxRef.current
    if (
      existingCtx &&
      existingCtx.state !== 'closed' &&
      sourcedElements.current.has(videoEl)
    ) {
      if (existingCtx.state === 'suspended') existingCtx.resume()
      return
    }

    // Close the old context so we start clean (new blob = new video element).
    // This is safe because a new video element is created each time previewBlobUrl changes.
    existingCtx?.close()
    // Reset the sourced-elements tracker for the new context session.
    sourcedElements.current = new WeakSet<HTMLMediaElement>()

    const ctx = new AudioContext()
    audioCtxRef.current = ctx

    const videoGain = ctx.createGain()
    videoGain.gain.value = videoVolume
    videoGain.connect(ctx.destination)
    videoGainRef.current = videoGain

    const bgmGain = ctx.createGain()
    bgmGain.gain.value = bgmVolume
    bgmGain.connect(ctx.destination)
    bgmGainRef.current = bgmGain

    // Route stitched video audio through video gain (guard against double-source)
    if (!sourcedElements.current.has(videoEl)) {
      const videoSrc = ctx.createMediaElementSource(videoEl)
      videoSrc.connect(videoGain)
      sourcedElements.current.add(videoEl)
    }

    // Route BGM through bgm gain (guard against double-source)
    if (bgmEl && !sourcedElements.current.has(bgmEl)) {
      const bgmSrc = ctx.createMediaElementSource(bgmEl)
      bgmSrc.connect(bgmGain)
      sourcedElements.current.add(bgmEl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally no deps — gain values set imperatively via refs; sourcedElements guards re-entry

  // ── Live gain updates (no re-render needed)
  const handleVideoVolumeChange = useCallback((v: number) => {
    setVideoVolume(v)
    if (videoGainRef.current) videoGainRef.current.gain.value = v
  }, [])

  const handleBgmVolumeChange = useCallback((v: number) => {
    setBgmVolume(v)
    if (bgmGainRef.current) bgmGainRef.current.gain.value = v
  }, [])

  // ── Play / pause preview
  const handlePlayPause = useCallback(async () => {
    const videoEl = videoRef.current
    const bgmEl   = bgmRef.current
    if (!videoEl || stitchState !== 'ready') return

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioCtxRef.current?.state === 'suspended') {
      await audioCtxRef.current.resume()
    }

    if (isPlaying) {
      videoEl.pause()
      bgmEl?.pause()
      setIsPlaying(false)
    } else {
      // Sync BGM currentTime to video
      if (bgmEl) bgmEl.currentTime = videoEl.currentTime
      await Promise.all([
        videoEl.play(),
        bgmEl ? bgmEl.play().catch(() => {}) : Promise.resolve(),
      ])
      setIsPlaying(true)
    }
  }, [isPlaying, stitchState])

  // Keep isPlaying in sync when video ends naturally
  useEffect(() => {
    const videoEl = videoRef.current
    if (!videoEl) return
    const onEnded = () => {
      bgmRef.current?.pause()
      setIsPlaying(false)
    }
    videoEl.addEventListener('ended', onEnded)
    return () => videoEl.removeEventListener('ended', onEnded)
  }, [previewBlobUrl])

  // ── Phase 1: Stitch video clips into a preview blob (NO BGM baked in)
  const handleStitch = useCallback(async () => {
    if (!storyboard || !canvasRef.current) return
    const clips = deriveClips(storyboard)
    const readyClips = clips.filter(c => c.status === 'ready' && c.url)
    if (readyClips.length === 0) return

    setStitchState('stitching')
    setStitchProgress(0)
    setStitchClipIdx(0)
    setStitchError(null)
    setIsPlaying(false)
    setExportState('idle')
    setMp4Url(null)

    if (previewBlobRef.current) { URL.revokeObjectURL(previewBlobRef.current); previewBlobRef.current = null }
    if (mp4BlobRef.current)     { URL.revokeObjectURL(mp4BlobRef.current);     mp4BlobRef.current = null }
    setPreviewBlobUrl(null)

    try {
      const canvas = canvasRef.current
      canvas.width  = 1280
      canvas.height = 720
      const ctx = canvas.getContext('2d')!

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'

      // Audio context just for the stitch pass — captures video clip audio only, NO BGM
      const audioCtx  = new AudioContext()
      const audioDest = audioCtx.createMediaStreamDestination()
      const vidGain   = audioCtx.createGain()
      vidGain.gain.value = 1.0
      vidGain.connect(audioDest)

      const chunks: Blob[] = []
      const videoStream    = canvas.captureStream(30)
      const combined       = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ])

      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 5_000_000 })
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

      const startTime = Date.now()
      recorder.start(100)

      for (let i = 0; i < readyClips.length; i++) {
        if (!mountedRef.current) break
        setStitchClipIdx(i)

        await new Promise<void>((resolve, reject) => {
          const vid        = document.createElement('video')
          vid.src          = readyClips[i].url!
          vid.crossOrigin  = 'anonymous'
          vid.muted        = false
          vid.playsInline  = true
          vid.preload      = 'auto'

          const src = audioCtx.createMediaElementSource(vid)
          src.connect(vidGain)

          vid.onloadeddata = () => vid.play().catch(reject)
          vid.onerror      = () => reject(new Error(`Failed to load clip ${readyClips[i].shotKey}`))

          let rafId: number
          const draw = () => {
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
            if (!vid.ended && !vid.paused) rafId = requestAnimationFrame(draw)
          }
          vid.onplay  = () => { rafId = requestAnimationFrame(draw) }
          vid.onended = () => {
            cancelAnimationFrame(rafId)
            ctx.drawImage(vid, 0, 0, canvas.width, canvas.height)
            src.disconnect()
            setStitchProgress(Math.round(((i + 1) / readyClips.length) * 100))
            resolve()
          }
        })
      }

      audioCtx.close()
      const durationMs = Date.now() - startTime
      recorder.stop()
      await new Promise<void>(resolve => { recorder.onstop = () => resolve() })

      const raw   = new Blob(chunks, { type: mimeType })
      const fixed = await fixWebmDuration(raw, durationMs, { logger: false })
      const url   = URL.createObjectURL(fixed)
      previewBlobRef.current = url

      if (!mountedRef.current) return
      setPreviewBlobUrl(url)
      setStitchState('ready')
    } catch (err) {
      console.error('[export] Stitch failed:', err)
      setStitchError(String(err))
      setStitchState('error')
    }
  }, [storyboard])

  // ── Wire AudioContext exactly when the video element mounts into the DOM.
  // No stitchState dep — the video element only renders when previewBlobUrl is set
  // (which only happens after stitching completes), so readiness is implicit.
  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el
    if (el) setupAudioContext()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // stable — setupAudioContext is also stable (no deps)

  // Swap BGM source without re-stitching
  useEffect(() => {
    const bgmEl = bgmRef.current
    if (!bgmEl || !activeBgm?.url) return
    const wasPlaying = isPlaying
    if (wasPlaying) bgmEl.pause()
    bgmEl.src         = activeBgm.url
    bgmEl.currentTime = videoRef.current?.currentTime ?? 0
    if (wasPlaying) bgmEl.play().catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBgmId])

  // ── Phase 3: Convert WebM → MP4 via ffmpeg.wasm
  const handleDownloadMp4 = useCallback(async () => {
    if (!previewBlobUrl || exportState === 'converting') return

    setExportState('converting')
    setExportProgress(0)
    setExportError(null)
    if (mp4BlobRef.current) { URL.revokeObjectURL(mp4BlobRef.current); mp4BlobRef.current = null }
    setMp4Url(null)

    try {
      // ── 1. Dynamically import ffmpeg (avoids SSR crash and keeps initial bundle small)
      const { FFmpeg }   = await import('@ffmpeg/ffmpeg')
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util')

      const ff = new FFmpeg()

      ff.on('progress', ({ progress }) => {
        if (mountedRef.current) setExportProgress(Math.round(Math.min(progress, 0.95) * 100))
      })

      // Load WASM core from CDN (single-thread — no SharedArrayBuffer required)
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'
      await ff.load({
        coreURL:   await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
        wasmURL:   await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })

      setExportProgress(10)

      // ── 2. Fetch the preview WebM blob and write to ffmpeg FS
      const webmData = await fetchFile(previewBlobUrl)
      await ff.writeFile('input.webm', webmData)

      // ── 3. If BGM is available, fetch it and write to FS, then mix in ffmpeg
      let ffmpegCmd: string[]
      if (activeBgm?.url) {
        const bgmData = await fetchFile(activeBgm.url)
        await ff.writeFile('bgm.mp3', bgmData)

        // Mix video audio + BGM with gain levels, encode to MP4
        const vidVol = videoVolume.toFixed(3)
        const bgmVol = bgmVolume.toFixed(3)
        ffmpegCmd = [
          '-i', 'input.webm',
          '-i', 'bgm.mp3',
          '-filter_complex',
          `[0:a]volume=${vidVol}[va];[1:a]volume=${bgmVol}[ba];[va][ba]amix=inputs=2:duration=first[aout]`,
          '-map', '0:v',
          '-map', '[aout]',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', 'faststart',
          '-shortest',
          'output.mp4',
        ]
      } else {
        // No BGM — just transcode the video
        ffmpegCmd = [
          '-i', 'input.webm',
          '-c:v', 'libx264',
          '-preset', 'fast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', 'faststart',
          'output.mp4',
        ]
      }

      await ff.exec(ffmpegCmd)
      setExportProgress(95)

      // ── 4. Read output and create download URL
      const data = await ff.readFile('output.mp4')
      // FileData may be Uint8Array (with SharedArrayBuffer) or string — copy to a regular ArrayBuffer
      const raw  = data instanceof Uint8Array ? new Uint8Array(data).buffer : new TextEncoder().encode(String(data)).buffer
      const blob = new Blob([raw], { type: 'video/mp4' })
      const url  = URL.createObjectURL(blob)
      mp4BlobRef.current = url

      if (!mountedRef.current) return
      setMp4Url(url)
      setExportProgress(100)
      setExportState('done')

      // ── 5. Auto-trigger download
      const a     = document.createElement('a')
      a.href     = url
      a.download = `${projectTitle || 'teaser'}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('[export] MP4 conversion failed:', err)
      if (mountedRef.current) {
        setExportError(String(err))
        setExportState('error')
      }
    }
  }, [previewBlobUrl, activeBgm, bgmVolume, videoVolume, projectTitle, exportState])

  // ── Derived
  const displayClips    = storyboard ? deriveClips(storyboard) : []
  const readyClipCount  = displayClips.filter(c => c.status === 'ready' && c.url).length
  const totalDuration   = displayClips.reduce((s, c) => s + c.duration, 0) || TOTAL_S

  // ─── Loading / Error screens ─────────────────────────────────────────────

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

  // ─── Main ────────────────────────────────────────────────────────────────

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Sound',    href: `/sound/${projectId}` },
          { label: 'Export',   current: true },
        ]}
      />

      <WorkflowStepper current="export" projectId={projectId} />

      {/* Offscreen canvas for stitching */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Hidden BGM audio element — kept alive in DOM for AudioContext routing */}
      {activeBgm?.url && (
        <audio
          ref={bgmRef}
          src={activeBgm.url}
          crossOrigin="anonymous"
          preload="auto"
          style={{ display: 'none' }}
        />
      )}

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
              Preview your film, adjust the mix, then download as MP4
            </p>
          </div>

          {/* BGM Picker */}
          {bgms.length > 1 && (
            <BgmPicker bgms={bgms} activeId={activeBgmId} onSelect={id => setActiveBgmId(id)} />
          )}

          {/* ── Video Player ── */}
          <div className="rounded border overflow-hidden mb-6" style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}>

            {/* 16:9 player area */}
            <div className="relative w-full" style={{ aspectRatio: '16/9', background: 'var(--canvas)' }}>

              {/* Viewfinder corners — always shown */}
              <div className="absolute inset-8 pointer-events-none" style={{ zIndex: 2 }}>
                {['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r',
                  'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((cls, i) => (
                  <div key={i} className={`absolute w-6 h-6 ${cls}`} style={{ borderColor: 'var(--border-emphasis)' }} />
                ))}
              </div>

              {/* Preview video — unmuted so AudioContext can capture its audio track */}
              {previewBlobUrl && (
                <video
                  ref={videoRefCallback}
                  src={previewBlobUrl}
                  className="w-full h-full object-cover"
                  playsInline
                  preload="auto"
                  crossOrigin="anonymous"
                />
              )}

              {/* Stitching progress */}
              {stitchState === 'stitching' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6" style={{ zIndex: 3 }}>
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-amber)' }} />
                  <div className="w-64 space-y-2">
                    <p className="text-sm font-light text-center" style={{ color: 'var(--text-secondary)' }}>
                      Stitching clip {stitchClipIdx + 1} of {readyClipCount}…
                    </p>
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${stitchProgress}%`, background: 'var(--accent-amber)' }}
                      />
                    </div>
                    <p className="text-[10px] font-slate text-center" style={{ color: 'var(--text-muted)' }}>
                      {stitchProgress}% — happens once
                    </p>
                  </div>
                </div>
              )}

              {/* Stitch error */}
              {stitchState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ zIndex: 3 }}>
                  <AlertCircle className="w-8 h-8" style={{ color: 'var(--accent-red)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Stitch failed</p>
                  <p className="text-[10px] max-w-xs text-center" style={{ color: 'var(--text-muted)' }}>{stitchError}</p>
                  <Button variant="secondary" size="sm" onClick={handleStitch}>
                    <RefreshCw className="w-3 h-3" /> Retry
                  </Button>
                </div>
              )}

              {/* Idle — prompt to stitch */}
              {stitchState === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6" style={{ zIndex: 3 }}>
                  <button
                    onClick={handleStitch}
                    className="w-16 h-16 rounded-full border flex items-center justify-center cursor-pointer group"
                    style={{ borderColor: 'var(--accent-amber)', background: 'rgba(170,136,68,0.1)' }}
                  >
                    <Play className="w-7 h-7 ml-0.5 transition-transform duration-200 group-hover:scale-110" style={{ color: 'var(--accent-amber)' }} />
                  </button>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-light" style={{ color: 'var(--text-primary)' }}>
                      {readyClipCount} clips ready
                    </p>
                    <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
                      Click to prepare preview
                    </p>
                  </div>
                </div>
              )}

              {/* Ready — play / pause overlay */}
              {stitchState === 'ready' && (
                <button
                  onClick={handlePlayPause}
                  className="absolute inset-0 flex items-center justify-center group"
                  style={{ zIndex: 3, background: isPlaying ? 'transparent' : 'rgba(0,0,0,0.35)' }}
                >
                  {!isPlaying && (
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-150 group-hover:scale-110"
                      style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(6px)' }}
                    >
                      <Play className="w-6 h-6 ml-0.5 fill-white text-white" />
                    </div>
                  )}
                  {isPlaying && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}>
                      <Pause className="w-6 h-6 fill-white text-white" />
                    </div>
                  )}
                </button>
              )}
            </div>

            {/* Player status bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t gap-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full" style={{
                  background: stitchState === 'ready' ? 'var(--accent-green)'
                    : stitchState === 'stitching' ? 'var(--accent-amber)'
                    : 'var(--text-muted)',
                }} />
                <span className="text-[10px] font-slate" style={{
                  color: stitchState === 'ready' ? 'var(--accent-green)'
                    : stitchState === 'stitching' ? 'var(--accent-amber)'
                    : 'var(--text-muted)',
                }}>
                  {stitchState === 'ready'
                    ? isPlaying ? 'Playing preview' : 'Preview ready — click to play'
                    : stitchState === 'stitching' ? `Stitching… ${stitchProgress}%`
                    : 'Not yet prepared'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {stitchState === 'ready' && (
                  <Button variant="tertiary" size="sm" onClick={handleStitch} className="gap-1.5">
                    <RefreshCw className="w-2.5 h-2.5" /> Re-stitch
                  </Button>
                )}
                <span className="text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
                  {totalDuration}s
                </span>
              </div>
            </div>
          </div>

          {/* ── Audio Mix — live, no re-render ── */}
          <div className="mb-8 rounded border" style={{
            borderColor: 'var(--border-standard)',
            background: 'var(--surface-1)',
            opacity: stitchState !== 'ready' ? 0.5 : 1,
            pointerEvents: stitchState !== 'ready' ? 'none' : 'auto',
            transition: 'opacity 0.2s',
          }}>
            <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-[10px] tracking-[0.2em] uppercase font-slate" style={{ color: 'var(--text-muted)' }}>
                  Audio Mix
                </span>
              </div>
              {stitchState === 'ready' && (
                <span className="text-[9px] font-slate" style={{ color: 'var(--accent-green)' }}>
                  Live — no re-render needed
                </span>
              )}
            </div>
            <div className="px-5 py-1">
              <GainSlider
                label="Video Audio"
                icon={<Film className="w-3.5 h-3.5" />}
                value={videoVolume}
                onChange={handleVideoVolumeChange}
                color="var(--text-secondary)"
                disabled={stitchState !== 'ready'}
              />
              <GainSlider
                label="BGM"
                icon={<Music className="w-3.5 h-3.5" />}
                value={bgmVolume}
                onChange={handleBgmVolumeChange}
                color="var(--accent-amber)"
                disabled={stitchState !== 'ready' || !activeBgm}
              />
            </div>
          </div>

          {/* ── Download section ── */}
          {stitchState === 'ready' && (
            <div
              className="rounded border p-6"
              style={{ borderColor: 'rgba(170,136,68,0.3)', background: 'rgba(170,136,68,0.03)' }}
            >
              <p className="text-sm font-light mb-1 text-center" style={{ color: 'var(--text-primary)' }}>
                {exportState === 'done' ? 'Download started' : 'Export your teaser'}
              </p>
              <p className="text-[10px] font-slate mb-5 text-center" style={{ color: 'var(--text-muted)' }}>
                {totalDuration}s · MP4 (H.264) · {readyClipCount} clips{activeBgm ? ' · soundtrack mixed in' : ''}
              </p>

              {/* Error */}
              {exportState === 'error' && (
                <div className="mb-4 rounded border px-3 py-2 flex items-center gap-2"
                  style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
                  <AlertCircle className="w-3.5 h-3.5 flex-none" style={{ color: 'var(--accent-red)' }} />
                  <p className="text-[10px]" style={{ color: 'var(--accent-red)' }}>{exportError}</p>
                </div>
              )}

              {/* Download button */}
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={handleDownloadMp4}
                  disabled={exportState === 'converting'}
                  className="relative overflow-hidden rounded border px-8 py-3 flex items-center gap-3 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    borderColor: exportState === 'done' ? 'var(--accent-green)' : 'var(--accent-amber)',
                    background: exportState === 'done'
                      ? 'rgba(90,138,90,0.08)'
                      : exportState === 'converting'
                      ? 'rgba(170,136,68,0.04)'
                      : 'rgba(170,136,68,0.08)',
                    color: exportState === 'done' ? 'var(--accent-green)' : 'var(--accent-amber)',
                    minWidth: 220,
                    justifyContent: 'center',
                  }}
                >
                  {/* Progress fill */}
                  {exportState === 'converting' && (
                    <div
                      className="absolute inset-0 transition-all duration-300"
                      style={{
                        width: `${exportProgress}%`,
                        background: 'rgba(170,136,68,0.12)',
                      }}
                    />
                  )}

                  <span className="relative flex items-center gap-2.5">
                    {exportState === 'converting'
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />
                    }
                    <span className="text-sm font-slate tracking-[0.08em]">
                      {exportState === 'converting'
                        ? `Converting… ${exportProgress}%`
                        : exportState === 'done'
                        ? 'Download again'
                        : 'Download MP4'}
                    </span>
                  </span>
                </button>

                {exportState === 'converting' && (
                  <p className="text-[9px] font-slate" style={{ color: 'var(--text-muted)' }}>
                    ffmpeg is encoding in your browser — this takes ~20–60s
                  </p>
                )}
                {exportState === 'idle' && (
                  <p className="text-[9px] font-slate" style={{ color: 'var(--text-muted)' }}>
                    Encodes in-browser with ffmpeg.wasm · no upload required
                  </p>
                )}
                {exportState === 'done' && mp4Url && (
                  <a href={mp4Url} download={`${projectTitle || 'teaser'}.mp4`}
                    className="text-[9px] font-slate underline" style={{ color: 'var(--text-muted)' }}>
                    Click here if download didn&apos;t start
                  </a>
                )}
              </div>
            </div>
          )}

          {/* No BGM notice */}
          {!activeBgm && stitchState !== 'stitching' && (
            <div className="mt-4 rounded border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: 'rgba(170,136,68,0.2)', background: 'rgba(170,136,68,0.03)' }}>
              <Volume2 className="w-4 h-4 flex-none" style={{ color: 'var(--accent-amber)', opacity: 0.7 }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No soundtrack found.{' '}
                <button onClick={() => router.push(`/sound/${projectId}`)} className="underline"
                  style={{ color: 'var(--accent-amber)' }}>
                  Add a soundtrack
                </button>
                {' '}— or continue without.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between py-4"
          style={{ maxWidth: 800, margin: '0 auto', paddingLeft: 40, paddingRight: 40 }}>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/sound/${projectId}`)}>
            <ArrowLeft className="w-3 h-3" /> Sound
          </Button>
          {exportState === 'done' && mp4Url && (
            <a href={mp4Url} download={`${projectTitle || 'teaser'}.mp4`}>
              <Button variant="secondary" size="sm" className="gap-2">
                <Download className="w-3 h-3" /> Save MP4
              </Button>
            </a>
          )}
        </div>
      </div>
    </main>
  )
}
