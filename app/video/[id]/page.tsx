'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import fixWebmDuration from 'fix-webm-duration'
import { useRouter, useParams } from 'next/navigation'
import { Film, Play, ArrowRight, ArrowLeft, Loader2, AlertCircle, AlertTriangle, RefreshCw, Clock } from 'lucide-react'
import type { VideoClip, StoryboardResult, StoryboardShot, BatchVideoFireResult, VideoGenConfig } from '@/lib/types'
import { getPendingVideoTasks, isVideoAll } from '@/lib/types'
import { generateShotVideo, checkVideoTask, generateStoryboardVideos, checkStoryboardVideoTasks } from '@/lib/argon-browser'
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
const POLL_INTERVAL_MS = 7_000

function sortKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const [aS, aF] = a.split('.').map(Number)
    const [bS, bF] = b.split('.').map(Number)
    return aS !== bS ? aS - bS : aF - bF
  })
}

/** Derive display clips from storyboard shots when no video generated yet */
function deriveClips(storyboard: StoryboardResult): VideoClip[] {
  const keys = sortKeys(Object.keys(storyboard.shots))
  const base = Math.floor(TOTAL_S / Math.max(keys.length, 1))
  return keys.map((key, i) => {
    const shot = storyboard.shots[key]
    // Use the video url if already succeeded
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

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

// ─── Compiled video player ────────────────────────────────────────────────────

function VideoPlayer({
  hasVideo,
  isGenerating,
  onGenerate,
  totalDuration,
  clips,
  genProgress,
  videoConfig,
  onConfigChange,
}: {
  hasVideo: boolean
  isGenerating: boolean
  onGenerate: () => void
  totalDuration: number
  clips?: VideoClip[]
  genProgress: { done: number; total: number } | null
  videoConfig: VideoGenConfig
  onConfigChange: (config: VideoGenConfig) => void
}) {
  type StitchState = 'idle' | 'stitching' | 'ready' | 'error'
  const [stitchState, setStitchState] = useState<StitchState>('idle')
  const [stitchProgress, setStitchProgress] = useState(0) // 0–100
  const [stitchClipIdx, setStitchClipIdx] = useState(0)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [stitchError, setStitchError] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const blobUrlRef = useRef<string | null>(null)

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current) }
  }, [])

  const handleStitch = useCallback(async () => {
    if (!clips || clips.length === 0) return
    const readyClips = clips.filter(c => c.status === 'ready' && c.url)
    if (readyClips.length === 0) return

    setStitchState('stitching')
    setStitchProgress(0)
    setStitchClipIdx(0)
    setStitchError(null)

    try {
      const canvas = canvasRef.current!
      canvas.width = 1280
      canvas.height = 720
      const ctx = canvas.getContext('2d')!

      // Pick best supported codec
      const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm'

      // Set up AudioContext to capture audio from each clip
      const audioCtx = new AudioContext()
      const audioDest = audioCtx.createMediaStreamDestination()

      const chunks: Blob[] = []
      const videoStream = canvas.captureStream(30)

      // Combine canvas video track + audio destination track
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ])

      const mimeTypeWithAudio = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) ?? mimeType

      const recorder = new MediaRecorder(combinedStream, { mimeType: mimeTypeWithAudio, videoBitsPerSecond: 4_000_000 })
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }

      const startTime = Date.now()
      recorder.start(100) // collect chunks every 100ms

      for (let i = 0; i < readyClips.length; i++) {
        setStitchClipIdx(i)
        const clip = readyClips[i]

        await new Promise<void>((resolve, reject) => {
          const vid = document.createElement('video')
          vid.src = clip.url!
          vid.crossOrigin = 'anonymous'
          vid.muted = false  // unmuted — audio captured via AudioContext
          vid.playsInline = true
          vid.preload = 'auto'

          // Route this clip's audio into the shared AudioContext destination
          const source = audioCtx.createMediaElementSource(vid)
          source.connect(audioDest)

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
            setStitchProgress(Math.round(((i + 1) / readyClips.length) * 100))
            resolve()
          }
        })
      }

      audioCtx.close()

      const durationMs = Date.now() - startTime
      recorder.stop()

      await new Promise<void>(resolve => { recorder.onstop = () => resolve() })

      const rawBlob = new Blob(chunks, { type: mimeTypeWithAudio })

      // Fix WebM duration metadata so the scrubber works correctly
      const fixedBlob = await fixWebmDuration(rawBlob, durationMs, { logger: false })

      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      const url = URL.createObjectURL(fixedBlob)
      blobUrlRef.current = url
      setBlobUrl(url)
      setStitchState('ready')
    } catch (err) {
      console.error('[VideoPlayer] Stitch failed:', err)
      setStitchError(String(err))
      setStitchState('error')
    }
  }, [clips])

  const readyClipCount = clips?.filter(c => c.status === 'ready' && c.url).length ?? 0

  return (
    <div
      className="w-full rounded overflow-hidden border"
      style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
    >
      {/* Offscreen canvas for stitching */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Player area — 16:9 */}
      <div className="relative w-full" style={{ aspectRatio: '16/9', background: 'var(--canvas)' }}>

        {/* Compiled blob playing */}
        {stitchState === 'ready' && blobUrl ? (
          <video src={blobUrl} className="w-full h-full object-cover" controls autoPlay />
        ) : (
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

            {/* Generating clips state */}
            {isGenerating && (
              <div className="flex flex-col items-center gap-5 w-72">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
                {genProgress ? (
                  <div className="w-full space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>
                        Rendering {genProgress.done} of {genProgress.total} shots
                      </p>
                      <span className="text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {genProgress.done}/{genProgress.total}
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${genProgress.total > 0 ? Math.round((genProgress.done / genProgress.total) * 100) : 0}%`,
                          background: 'var(--accent-amber)',
                        }}
                      />
                    </div>
                    <p className="text-[10px] font-slate text-center" style={{ color: 'var(--text-muted)' }}>
                      Waiting for Runway to render…
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-slate" style={{ color: 'var(--text-secondary)' }}>Preparing…</p>
                )}
              </div>
            )}

            {/* Stitching state */}
            {stitchState === 'stitching' && (
              <div className="flex flex-col items-center gap-5 w-64">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-amber)' }} />
                <div className="w-full space-y-2">
                  <p className="text-sm font-light text-center" style={{ color: 'var(--text-secondary)' }}>
                    Stitching clip {stitchClipIdx + 1} of {readyClipCount}…
                  </p>
                  {/* Progress bar */}
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${stitchProgress}%`, background: 'var(--accent-amber)' }}
                    />
                  </div>
                  <p className="text-[10px] font-slate text-center" style={{ color: 'var(--text-muted)' }}>
                    {stitchProgress}% — processing in real time
                  </p>
                </div>
              </div>
            )}

            {/* Error state */}
            {stitchState === 'error' && (
              <div className="flex flex-col items-center gap-4 text-center px-8">
                <AlertCircle className="w-8 h-8" style={{ color: 'var(--accent-red, #ef4444)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Stitch failed</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{stitchError}</p>
                <Button variant="secondary" size="sm" onClick={handleStitch}>Retry</Button>
              </div>
            )}

            {/* Ready to stitch — clips done, not yet stitched */}
            {!isGenerating && stitchState === 'idle' && hasVideo && (
              <div className="flex flex-col items-center gap-5 text-center">
                <button
                  onClick={handleStitch}
                  className="w-16 h-16 rounded-full border flex items-center justify-center cursor-pointer group"
                  style={{ borderColor: 'var(--accent-amber)', background: 'rgba(170,136,68,0.1)' }}
                >
                  <Play className="w-7 h-7 ml-0.5 transition-transform duration-200 group-hover:scale-110" style={{ color: 'var(--accent-amber)' }} />
                </button>
                <div className="space-y-1">
                  <p className="text-sm font-light" style={{ color: 'var(--text-primary)' }}>
                    {readyClipCount} clips ready
                  </p>
                  <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
                    Click to stitch &amp; play
                  </p>
                </div>
              </div>
            )}

            {/* Not yet generated */}
            {!isGenerating && stitchState === 'idle' && !hasVideo && (
              <div className="flex flex-col items-center gap-5 text-center">
                <div
                  className="w-16 h-16 rounded-full border flex items-center justify-center"
                  style={{ borderColor: 'var(--border-emphasis)', background: 'rgba(255,255,255,0.03)' }}
                >
                  <Play className="w-7 h-7 ml-0.5" style={{ color: 'var(--text-tertiary)' }} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>Compiled video will appear here</p>
                  <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
                    {totalDuration}s · {Math.round(totalDuration / 3.5)} clips
                  </p>
                </div>
                {/* Config controls */}
                <div className="flex items-center gap-3 mt-1">
                  <select
                    value={videoConfig.model}
                    onChange={e => onConfigChange({ ...videoConfig, model: e.target.value })}
                    className="text-[10px] font-slate px-2 py-1 rounded border outline-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
                  >
                    <option value="veo3.1">veo3.1</option>
                  </select>
                  <select
                    value={String(videoConfig.duration)}
                    onChange={e => onConfigChange({ ...videoConfig, duration: Number(e.target.value) })}
                    className="text-[10px] font-slate px-2 py-1 rounded border outline-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
                  >
                    <option value="4">4s</option>
                    <option value="8">8s</option>
                  </select>
                  <select
                    value={videoConfig.ratio}
                    onChange={e => onConfigChange({ ...videoConfig, ratio: e.target.value })}
                    className="text-[10px] font-slate px-2 py-1 rounded border outline-none"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', borderColor: 'var(--border-subtle)' }}
                  >
                    <option value="1280:720">16:9</option>
                    <option value="720:1280">9:16</option>
                  </select>
                </div>
                <Button variant="primary" size="md" onClick={onGenerate} disabled={isGenerating} className="group gap-2 mt-2">
                  Generate Video{' '}
                  <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Duration pill */}
        {(hasVideo || isGenerating) && stitchState !== 'ready' && (
          <div
            className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded font-slate text-[10px]"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--text-secondary)' }}
          >
            <Clock className="w-3 h-3" />
            {totalDuration}s
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center px-5 py-3 border-t gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="h-1.5 w-1.5 rounded-full" style={{
          background: stitchState === 'ready' ? 'var(--accent-green)'
            : stitchState === 'stitching' ? 'var(--accent-amber)'
            : hasVideo ? 'var(--accent-green)' : 'var(--text-muted)'
        }} />
        <span className="text-[10px] font-slate" style={{
          color: stitchState === 'ready' ? 'var(--accent-green)'
            : stitchState === 'stitching' ? 'var(--accent-amber)'
            : hasVideo ? 'var(--accent-green)' : 'var(--text-muted)'
        }}>
          {stitchState === 'ready' ? 'Video ready'
            : stitchState === 'stitching' ? `Stitching… ${stitchProgress}%`
            : hasVideo ? 'Clips ready — click play to compile'
            : isGenerating ? 'Generating…' : 'Not yet generated'}
        </span>
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
  onRegenerate,
  onCheckStatus,
  isRegenerating,
  isChecking,
}: {
  clip: VideoClip
  index: number
  shot?: StoryboardShot
  isFirst: boolean
  onRegenerate: (shotKey: string) => void
  onCheckStatus: (shotKey: string) => void
  isRegenerating: boolean
  isChecking: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [playing, setPlaying] = useState(false)
  const thumbnail = clip.thumbnailUrl ?? (shot ? getActiveImageUrl(shot) : null)
  const isPending = clip.status === 'pending' || clip.status === 'generating'
  const isFailed = clip.status === 'error'
  const hasTaskId = !!(shot?.video?.generations?.length)
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
          // eslint-disable-next-line @next/next/no-img-element
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

        {/* Shimmer overlay when pending/generating */}
        {isPending && (
          <div className="absolute inset-0 shimmer opacity-30" />
        )}

        {/* Play button — click to play (ready clips only) */}
        {!isPending && clip.url && !playing && (
          <button
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            onClick={() => setPlaying(true)}
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}>
              <Play className="w-4 h-4 fill-white text-white ml-0.5" />
            </div>
          </button>
        )}

        {/* Inline video player */}
        {playing && clip.url && (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            src={clip.url}
            autoPlay
            controls
            onEnded={() => setPlaying(false)}
          />
        )}

        {/* Clip index + shot key */}
        {!playing && (
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
        )}

        {/* Duration badge */}
        {!playing && (
          <div
            className="absolute bottom-2 right-2 text-[9px] font-slate px-1.5 py-0.5 rounded"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--text-secondary)' }}
          >
            {clip.duration}s
          </div>
        )}
      </div>

      {/* ── Details ── */}
      <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
        {/* Top: meta chips */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {/* Status chip */}
          <span
            className="text-[9px] font-slate px-2 py-0.5 rounded uppercase tracking-wide"
            style={{
              background: isFailed ? 'rgba(204,68,68,0.08)' : isPending ? 'rgba(255,255,255,0.04)' : 'rgba(90,138,90,0.08)',
              color: isFailed ? 'var(--accent-red)' : isPending ? 'var(--text-muted)' : 'var(--accent-green)',
              border: `1px solid ${isFailed ? 'rgba(204,68,68,0.2)' : isPending ? 'var(--border-subtle)' : 'rgba(90,138,90,0.2)'}`,
            }}
          >
            {isFailed ? 'Failed' : clip.status === 'generating' ? 'Rendering' : isPending ? 'Pending' : 'Ready'}
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

        {/* Clip-level actions — appear on hover */}
        <div
          className="flex justify-end mt-4 transition-opacity duration-150 gap-2"
          style={{ opacity: hovered ? 1 : 0 }}
        >
          {isPending && hasTaskId && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onCheckStatus(clip.shotKey)}
              disabled={isChecking}
            >
              {isChecking
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Checking…</>
                : <><RefreshCw className="w-3 h-3" /> Check status</>
              }
            </Button>
          )}
          {(isFailed || !isPending) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRegenerate(clip.shotKey)}
              disabled={isRegenerating}
            >
              {isRegenerating
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating</>
                : <><RefreshCw className="w-3 h-3" /> Regenerate clip</>
              }
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Session helpers ──────────────────────────────────────────────────────────

export default function VideoPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null)
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'generating' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [regeneratingClip, setRegeneratingClip] = useState<string | null>(null)
  const [checkingClip, setCheckingClip] = useState<string | null>(null)
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null)
  const [skippedShots, setSkippedShots] = useState<BatchVideoFireResult['skipped']>([])
  const [fireFailures, setFireFailures] = useState<BatchVideoFireResult['failures']>([])
  const [videoConfig, setVideoConfig] = useState<VideoGenConfig>({
    model: 'veo3.1',
    duration: 4,
    ratio: '1280:720',
  })

  const mountedRef = useRef(true)

  useEffect(() => {
    if (storyboard?.projectTitle) {
      document.title = `${storyboard.projectTitle} | Video`
    } else {
      document.title = "Video | Director's Room"
    }
  }, [storyboard?.projectTitle])

  const persistStoryboard = useCallback((sb: StoryboardResult) => {
    setStoryboard(sb)
  }, [])

  // ── Batch poll loop ──────────────────────────────────────────────────────────
  const runPollLoop = useCallback(async (sb: StoryboardResult, firedTotal?: number): Promise<StoryboardResult> => {
    let current = sb
    const total = firedTotal ?? Object.values(sb.shots).filter(s =>
      s.video?.generations?.some(g => g.status === 'pending' || g.status === 'processing')
    ).length

    while (mountedRef.current) {
      if (!mountedRef.current) return current

      try {
        const { status, storyboardResult } = await checkStoryboardVideoTasks(projectId)
        current = { ...storyboardResult, projectTitle: current.projectTitle }
        persistStoryboard(current)

        const doneCount = Object.values(status.shots_status)
          .filter(s => s.status === 'succeeded' || s.status === 'failed').length
        setGenProgress(total > 0 ? { done: doneCount, total } : null)

        if (status.all_done) {
          try {
            const res = await fetch(`/api/projects/${projectId}`)
            if (res.ok) {
              const { project } = await res.json()
              if (project?.storyboard?.shots) {
                current = {
                  projectId: project.id,
                  projectTitle: project.title,
                  shots: project.storyboard.shots,
                  activeGrid: project.storyboard.active_grid,
                }
                persistStoryboard(current)
              }
            }
          } catch { /* best-effort */ }
          break
        }
      } catch (err) {
        console.error('[video] Batch poll failed:', err)
      }

      if (!mountedRef.current) return current
      await sleep(POLL_INTERVAL_MS)
    }

    return current
  }, [projectId, persistStoryboard])

  // ── Boot ─────────────────────────────────────────────────────────────────────
  const autoFired = useRef(false)
  useEffect(() => {
    mountedRef.current = true

    async function fetchFromAPI() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const { project } = await res.json()
        if (!mountedRef.current) return
        if (!project?.storyboard?.shots || Object.keys(project.storyboard.shots).length === 0) {
          router.push('/')
          return
        }
        const sb: StoryboardResult = {
          projectId: project.id,
          projectTitle: project.title,
          shots: project.storyboard.shots,
          activeGrid: project.storyboard.active_grid,
        }
        setStoryboard(sb)

        const pending = getPendingVideoTasks(sb.shots)
        if (pending.length > 0) {
          setPageState('generating')
          runPollLoop(sb).then(() => {
            if (mountedRef.current) setPageState('ready')
          })
        } else if (!isVideoAll(sb.shots) && !autoFired.current) {
          autoFired.current = true
          setPageState('generating')
          generateStoryboardVideos(projectId)
            .then(({ fire, storyboardResult }) => {
              if (!mountedRef.current) return
              const updated = { ...storyboardResult, projectTitle: sb.projectTitle }
              persistStoryboard(updated)
              if (fire.skipped.length > 0) setSkippedShots(fire.skipped)
              if (fire.failures.length > 0) setFireFailures(fire.failures)
              if (fire.fired_count > 0) {
                setGenProgress({ done: 0, total: fire.fired_count })
                return runPollLoop(updated, fire.fired_count)
              }
              return updated
            })
            .then(() => {
              if (mountedRef.current) setPageState('ready')
            })
            .catch(err => {
              console.error('[video] Auto-fire failed:', err)
              if (mountedRef.current) {
                setError(`Failed to generate videos: ${String(err)}`)
                setPageState('error')
              }
            })
        } else {
          setPageState('ready')
        }
      } catch {
        if (mountedRef.current) router.push('/')
      }
    }
    fetchFromAPI()

    return () => { mountedRef.current = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Generate all shots via batch API ──────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!storyboard) return
    setError(null)
    setPageState('generating')
    setSkippedShots([])
    setFireFailures([])
    setGenProgress(null)

    try {
      const { fire, storyboardResult } = await generateStoryboardVideos(projectId, videoConfig)
      const updated = { ...storyboardResult, projectTitle: storyboard.projectTitle }
      persistStoryboard(updated)

      if (fire.skipped.length > 0) setSkippedShots(fire.skipped)
      if (fire.failures.length > 0) setFireFailures(fire.failures)

      if (fire.fired_count > 0) {
        setGenProgress({ done: 0, total: fire.fired_count })
        await runPollLoop(updated, fire.fired_count)
      } else if (fire.skipped_count > 0 && fire.fired_count === 0) {
        setError('All shots were skipped — no new videos to generate.')
      }

      if (mountedRef.current) setPageState('ready')
    } catch (err) {
      console.error('[video] Batch fire failed:', err)
      if (mountedRef.current) {
        setError(`Failed to generate videos: ${String(err)}`)
        setPageState('error')
      }
    }
  }, [storyboard, projectId, persistStoryboard, runPollLoop, videoConfig])

  // ── Regenerate a single clip ──────────────────────────────────────────────
  const handleRegenerateClip = useCallback(async (shotKey: string) => {
    if (!storyboard || regeneratingClip) return
    setRegeneratingClip(shotKey)
    setError(null)

    try {
      const gen = await generateShotVideo(projectId, shotKey)
      const prevGens = storyboard.shots[shotKey].video?.generations ?? []
      let current = {
        ...storyboard,
        shots: {
          ...storyboard.shots,
          [shotKey]: {
            ...storyboard.shots[shotKey],
            video: {
              active: storyboard.shots[shotKey].video?.active ?? 0,
              generations: [...prevGens, gen],
            },
          },
        },
      }
      persistStoryboard(current)
      current = await runPollLoop(current)
    } catch (err) {
      console.error(`[video] Regenerate clip failed for ${shotKey}:`, err)
      if (mountedRef.current) setError(`Failed to regenerate shot ${shotKey}: ${String(err)}`)
    } finally {
      if (mountedRef.current) setRegeneratingClip(null)
    }
  }, [storyboard, projectId, persistStoryboard, runPollLoop, regeneratingClip])

  // ── Refetch full project and update storyboard ───────────────────────────────
  const refetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}`)
    if (!res.ok) throw new Error('Failed to fetch project')
    const { project } = await res.json()
    if (!project?.storyboard?.shots) throw new Error('No storyboard in project')
    const sb: StoryboardResult = {
      projectId: project.id,
      shots: project.storyboard.shots,
      activeGrid: project.storyboard.active_grid,
    }
    persistStoryboard(sb)
    return sb
  }, [projectId, persistStoryboard])

  // ── Check status of a single clip ───────────────────────────────────────────
  const handleCheckStatus = useCallback(async (shotKey: string) => {
    if (!storyboard || checkingClip) return
    const shot = storyboard.shots[shotKey]
    const gens = shot.video?.generations
    if (!gens || gens.length === 0) {
      console.warn(`[video] No generations found for shot ${shotKey}`)
      return
    }

    const latest = gens[gens.length - 1]
    setCheckingClip(shotKey)
    try {
      const gen = await checkVideoTask(projectId, shotKey, latest.task_id)

      if (gen.status === 'succeeded') {
        // Authoritative state lives on the backend — refetch full project
        await refetchProject()
      } else {
        // Just update the local generation status
        const updated = {
          ...storyboard,
          shots: {
            ...storyboard.shots,
            [shotKey]: {
              ...shot,
              video: {
                active: shot.video?.active ?? 0,
                generations: gens.map(g => g.task_id === latest.task_id ? gen : g),
              },
            },
          },
        }
        persistStoryboard(updated)
      }
    } catch (err) {
      console.error(`[video] Check status failed for ${shotKey}:`, err)
      if (mountedRef.current) setError(`Failed to check status for shot ${shotKey}: ${String(err)}`)
    } finally {
      if (mountedRef.current) setCheckingClip(null)
    }
  }, [storyboard, projectId, persistStoryboard, checkingClip, refetchProject])

  // ── Loading ──────────────────────────────────────────────────────────────
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

  const hasVideo = storyboard ? isVideoAll(storyboard.shots) : false
  const isGenerating = pageState === 'generating'

  const displayClips: VideoClip[] = storyboard ? deriveClips(storyboard) : []
  const totalDuration = displayClips.reduce((s, c) => s + c.duration, 0) || TOTAL_S

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

          {/* ── Skipped shots ── */}
          {skippedShots.length > 0 && (
            <div
              className="mb-4 rounded border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: 'rgba(170,136,68,0.25)', background: 'rgba(170,136,68,0.05)' }}
            >
              <AlertTriangle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-amber)' }} />
              <p className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>
                {skippedShots.length} shot{skippedShots.length > 1 ? 's' : ''} skipped:{' '}
                {skippedShots.map(s => `${s.shot_id} (${s.reason})`).join(', ')}
              </p>
              <Button variant="tertiary" size="sm" onClick={() => setSkippedShots([])}>Dismiss</Button>
            </div>
          )}

          {/* ── Fire failures ── */}
          {fireFailures.length > 0 && (
            <div
              className="mb-4 rounded border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}
            >
              <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
              <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>
                {fireFailures.length} shot{fireFailures.length > 1 ? 's' : ''} failed to fire:{' '}
                {fireFailures.map(f => `${f.shot_id}${f.reason ? ` (${f.reason})` : ''}`).join(', ')}. Use &quot;Regenerate clip&quot; to retry.
              </p>
              <Button variant="tertiary" size="sm" onClick={() => setFireFailures([])}>Dismiss</Button>
            </div>
          )}

          {/* ── Compiled video player ── */}
          <div className="mb-10">
            <VideoPlayer
              hasVideo={hasVideo}
              isGenerating={isGenerating}
              onGenerate={handleGenerate}
              totalDuration={totalDuration}
              clips={displayClips}
              genProgress={genProgress}
              videoConfig={videoConfig}
              onConfigChange={setVideoConfig}
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
                    onRegenerate={handleRegenerateClip}
                    onCheckStatus={handleCheckStatus}
                    isRegenerating={regeneratingClip === clip.shotKey}
                    isChecking={checkingClip === clip.shotKey}
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
