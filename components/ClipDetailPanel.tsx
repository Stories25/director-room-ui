'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Film, Play, RefreshCw, Loader2 } from 'lucide-react'
import type { VideoClip, StoryboardShot, ClipTransition } from '@/lib/types'
import TransitionPicker from './TransitionPicker'

function getActiveImageUrl(shot: StoryboardShot): string | null {
  const gens = shot.image?.generations
  if (!gens || gens.length === 0) return null
  const active = shot.image.active
  const gen = gens.find(g => g.version === active) ?? gens[gens.length - 1]
  return gen?.url ?? null
}

interface ClipDetailPanelProps {
  clip: VideoClip
  clipIndex: number
  shot?: StoryboardShot
  incomingTransition: ClipTransition
  isRegenerating: boolean
  onRegenerate: (shotKey: string) => void
  onTransitionChange: (transition: ClipTransition) => void
  onDeselect: () => void
}

export default function ClipDetailPanel({
  clip,
  clipIndex,
  shot,
  incomingTransition,
  isRegenerating,
  onRegenerate,
  onTransitionChange,
  onDeselect,
}: ClipDetailPanelProps) {
  const [playing, setPlaying] = useState(false)
  const [showTransPicker, setShowTransPicker] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const transBtnRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const thumbnail = clip.thumbnailUrl ?? (shot ? getActiveImageUrl(shot) : null)
  const isPending = clip.status === 'pending' || clip.status === 'generating'
  const isFailed = clip.status === 'error'
  const sd = shot?.script_data

  useEffect(() => {
    if (!showTransPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTransPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTransPicker])

  const handleTransitionClick = useCallback(() => {
    if (transBtnRef.current) {
      setAnchorRect(transBtnRef.current.getBoundingClientRect())
    }
    setShowTransPicker(true)
  }, [])

  return (
    <div
      className="rounded border overflow-hidden fade-up"
      style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
    >
      <div className="flex gap-5 px-5 py-4">
        <div
          className="relative flex-none rounded overflow-hidden"
          style={{ width: 180, aspectRatio: '16/9', background: 'var(--surface-2)', border: '1px solid var(--border-standard)' }}
        >
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnail}
              alt={clip.shotKey}
              className="w-full h-full object-cover"
              style={{ opacity: isPending ? 0.5 : 1 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film className="w-5 h-5" style={{ color: 'var(--border-standard)' }} />
            </div>
          )}

          {isPending && <div className="absolute inset-0 shimmer opacity-25" />}

          {!isPending && clip.url && !playing && (
            <button
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)' }}
              onClick={() => setPlaying(true)}
            >
              <Play className="w-5 h-5 fill-white text-white ml-0.5" />
            </button>
          )}

          {playing && clip.url && (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={clip.url}
              autoPlay
              controls
              onEnded={() => setPlaying(false)}
            />
          )}

          <div className="absolute top-1.5 left-1.5">
            <span
              className="text-[8px] font-slate px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--accent-amber)' }}
            >
              {clip.shotKey}
            </span>
          </div>

          <div className="absolute bottom-1.5 right-1.5">
            <span
              className="text-[8px] font-slate px-1.5 py-0.5 rounded tabular-nums"
              style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--text-secondary)' }}
            >
              {clip.duration}s
            </span>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <span
                className="text-[8px] font-slate px-2 py-0.5 rounded uppercase tracking-wide"
                style={{
                  background: isFailed ? 'rgba(204,68,68,0.10)' : isPending ? 'rgba(0,0,0,0.04)' : 'rgba(90,138,90,0.10)',
                  color: isFailed ? 'var(--accent-red)' : isPending ? 'var(--text-muted)' : 'var(--accent-green)',
                  border: `1px solid ${isFailed ? 'rgba(204,68,68,0.2)' : isPending ? 'var(--border-subtle)' : 'rgba(90,138,90,0.2)'}`,
                }}
              >
                {isFailed ? 'Failed' : clip.status === 'generating' ? 'Rendering' : isPending ? 'Pending' : 'Ready'}
              </span>
              {sd?.framing && (
                <span className="text-[8px] font-slate px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
                  {sd.framing}
                </span>
              )}
              {sd?.time_of_day && (
                <span className="text-[8px] font-slate px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
                  {sd.time_of_day}
                </span>
              )}
              {sd?.mood && (
                <span className="text-[8px] font-slate px-2 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
                  {sd.mood}
                </span>
              )}
            </div>

            <p
              className="text-sm font-light leading-relaxed mb-2"
              style={{ color: isPending ? 'var(--text-secondary)' : 'var(--text-primary)' }}
            >
              {clip.prompt || sd?.description || '—'}
            </p>

            <div className="flex gap-4">
              {sd?.camera_movement && (
                <p className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Camera</span> — {sd.camera_movement}
                </p>
              )}
              {sd?.lighting && (
                <p className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Lighting</span> — {sd.lighting}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-3" ref={pickerRef}>
              <span className="text-[9px] font-slate" style={{ color: 'var(--text-muted)' }}>
                Transition in:
              </span>
              <button
                ref={transBtnRef}
                onClick={handleTransitionClick}
                className="text-[9px] font-slate px-2 py-1 rounded border transition-colors duration-150"
                style={{
                  borderColor: incomingTransition.type === 'cut' ? 'var(--border-subtle)' : 'rgba(170,136,68,0.3)',
                  background: incomingTransition.type === 'cut' ? 'transparent' : 'rgba(170,136,68,0.06)',
                  color: incomingTransition.type === 'cut' ? 'var(--text-muted)' : 'var(--accent-amber)',
                }}
              >
                {incomingTransition.type === 'cut' ? 'Cut' : `${incomingTransition.type} ${incomingTransition.durationMs}ms`}
              </button>
              {showTransPicker && (
                <TransitionPicker
                  current={incomingTransition}
                  onApply={onTransitionChange}
                  anchorRect={anchorRect}
                  onClose={() => setShowTransPicker(false)}
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              {clipIndex > 0 && (
                <button
                  onClick={onDeselect}
                  className="text-[9px] font-slate px-2 py-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Deselect
                </button>
              )}
              {(isFailed || !isPending) && (
                <button
                  onClick={() => onRegenerate(clip.shotKey)}
                  disabled={isRegenerating}
                  className="text-[9px] tracking-[0.12em] uppercase font-slate px-3 py-1.5 rounded border transition-colors duration-150 disabled:opacity-40"
                  style={{ borderColor: 'var(--border-standard)', color: 'var(--text-secondary)', background: 'transparent' }}
                >
                  {isRegenerating
                    ? <span className="flex items-center gap-1.5"><Loader2 className="w-2.5 h-2.5 animate-spin" />Regenerating</span>
                    : <span className="flex items-center gap-1.5"><RefreshCw className="w-2.5 h-2.5" />Regenerate</span>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
