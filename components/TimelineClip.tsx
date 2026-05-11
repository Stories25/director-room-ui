'use client'

import { useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Film, Play, Loader2 } from 'lucide-react'
import type { VideoClip, StoryboardShot } from '@/lib/types'

function getActiveImageUrl(shot: StoryboardShot): string | null {
  const gens = shot.image?.generations
  if (!gens || gens.length === 0) return null
  const active = shot.image.active
  const gen = gens.find(g => g.version === active) ?? gens[gens.length - 1]
  return gen?.url ?? null
}

interface TimelineClipProps {
  clip: VideoClip
  index: number
  shot?: StoryboardShot
  isSelected: boolean
  onSelect: (index: number) => void
}

export default function TimelineClip({ clip, index, shot, isSelected, onSelect }: TimelineClipProps) {
  const [playing, setPlaying] = useState(false)
  const thumbRef = useRef<HTMLDivElement>(null)
  const thumbnail = clip.thumbnailUrl ?? (shot ? getActiveImageUrl(shot) : null)
  const isPending = clip.status === 'pending' || clip.status === 'generating'
  const isFailed = clip.status === 'error'

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: clip.shotKey })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 10 : 0,
  }

  const clipWidth = Math.max(80, clip.duration * 28)

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: clipWidth, flexShrink: 0 }}
      {...attributes}
      {...listeners}
    >
      <button
        onClick={e => {
          e.stopPropagation()
          onSelect(index)
        }}
        className="w-full rounded border overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing"
        style={{
          borderColor: isSelected ? 'var(--accent-amber)' : isFailed ? 'rgba(204,68,68,0.3)' : 'var(--border-standard)',
          background: isSelected ? 'rgba(170,136,68,0.06)' : 'var(--surface-1)',
          boxShadow: isSelected ? '0 0 0 1px var(--accent-amber)' : 'none',
          height: 64,
        }}
      >
        <div className="relative w-full h-full flex items-center">
          {thumbnail ? (
            <div ref={thumbRef} className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnail}
                alt={clip.shotKey}
                className="w-full h-full object-cover"
                style={{ opacity: isPending ? 0.45 : 1 }}
              />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
              <Film className="w-4 h-4" style={{ color: 'var(--border-standard)' }} />
            </div>
          )}

          {isPending && <div className="absolute inset-0 shimmer opacity-25" />}

          {isPending && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            </div>
          )}

          {!isPending && clip.url && !playing && (
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-150"
              style={{ background: 'rgba(0,0,0,0.35)' }}
              onClick={e => { e.stopPropagation(); setPlaying(true) }}
            >
              <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
            </div>
          )}

          {playing && clip.url && (
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={clip.url}
              autoPlay
              controls
              onEnded={() => setPlaying(false)}
              onClick={e => e.stopPropagation()}
            />
          )}

          <div className="absolute top-1 left-1 flex items-center gap-1" style={{ zIndex: 2 }}>
            <span
              className="text-[7px] font-slate px-1 py-px rounded"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--text-muted)' }}
            >
              {clip.shotKey}
            </span>
          </div>

          <div className="absolute bottom-1 right-1" style={{ zIndex: 2 }}>
            <span
              className="text-[7px] font-slate px-1 py-px rounded tabular-nums"
              style={{ background: 'rgba(0,0,0,0.7)', color: 'var(--text-secondary)' }}
            >
              {clip.duration}s
            </span>
          </div>

          <div className="absolute top-1 right-1" style={{ zIndex: 2 }}>
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: isFailed
                  ? 'var(--accent-red)'
                  : isPending
                  ? 'var(--accent-amber)'
                  : clip.status === 'ready'
                  ? 'var(--accent-green)'
                  : 'var(--text-muted)',
              }}
            />
          </div>
        </div>
      </button>
    </div>
  )
}
