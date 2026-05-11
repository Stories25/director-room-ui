'use client'

import { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { VideoClip, StoryboardShot, ClipTransition, TimelineState } from '@/lib/types'
import TimelineClip from './TimelineClip'
import TimelineSplice from './TimelineSplice'

interface FilmstripTimelineProps {
  clips: VideoClip[]
  shots: Record<string, StoryboardShot>
  timeline: TimelineState
  selectedClipIdx: number | null
  onSelectClip: (idx: number | null) => void
  onTimelineChange: (timeline: TimelineState) => void
}

export default function FilmstripTimeline({
  clips,
  shots,
  timeline,
  selectedClipIdx,
  onSelectClip,
  onTimelineChange,
}: FilmstripTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  const scrollBy = useCallback((delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
    setTimeout(updateScrollButtons, 300)
  }, [updateScrollButtons])

  const orderedClips = timeline.clipOrder.map(key => clips.find(c => c.shotKey === key)).filter(Boolean) as VideoClip[]

  const totalDuration = orderedClips.reduce((s, c) => s + c.duration, 0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = timeline.clipOrder.indexOf(String(active.id))
    const newIndex = timeline.clipOrder.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(timeline.clipOrder, oldIndex, newIndex)

    const newTransitions: Record<string, ClipTransition> = {}
    for (let i = 0; i < newOrder.length - 1; i++) {
      const key = `after-${i}`
      if (i === oldIndex || i === newIndex || (oldIndex < i && newIndex >= i) || (oldIndex > i && newIndex <= i)) {
        const srcIdx = Math.min(oldIndex, newIndex)
        newTransitions[key] = timeline.transitions[`after-${srcIdx}`] ?? { type: 'cut', durationMs: 0 }
      } else {
        newTransitions[key] = timeline.transitions[key] ?? { type: 'cut', durationMs: 0 }
      }
    }

    const newSelectedIdx = selectedClipIdx !== null
      ? newOrder.indexOf(timeline.clipOrder[selectedClipIdx])
      : null

    onTimelineChange({ clipOrder: newOrder, transitions: newTransitions })
    if (newSelectedIdx !== selectedClipIdx && newSelectedIdx !== -1) {
      onSelectClip(newSelectedIdx)
    }
  }, [timeline, selectedClipIdx, onTimelineChange, onSelectClip])

  const handleTransitionChange = useCallback((spliceIndex: number, transition: ClipTransition) => {
    onTimelineChange({
      ...timeline,
      transitions: {
        ...timeline.transitions,
        [`after-${spliceIndex}`]: transition,
      },
    })
  }, [timeline, onTimelineChange])

  return (
    <div
      className="rounded border overflow-hidden"
      style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
    >
      <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <span className="text-[9px] tracking-[0.25em] uppercase font-slate" style={{ color: 'var(--text-muted)' }}>
            Timeline
          </span>
          <span className="text-[9px] font-slate" style={{ color: 'var(--text-muted)' }}>
            {orderedClips.length} clips · {totalDuration}s
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canScrollLeft && (
            <button
              onClick={() => scrollBy(-200)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scrollBy(200)}
              className="p-1 rounded hover:bg-black/5 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="relative">
        <div
          className="flex items-center overflow-x-auto py-3 px-4"
          style={{ scrollbarWidth: 'none' }}
          ref={scrollRef}
          onScroll={updateScrollButtons}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={timeline.clipOrder}
              strategy={horizontalListSortingStrategy}
            >
              {orderedClips.map((clip, i) => (
                <div key={clip.shotKey} className="flex items-center">
                  <TimelineClip
                    clip={clip}
                    index={i}
                    shot={shots[clip.shotKey]}
                    isSelected={selectedClipIdx === i}
                    onSelect={onSelectClip}
                  />
                  {i < orderedClips.length - 1 && (
                    <TimelineSplice
                      index={i}
                      transition={timeline.transitions[`after-${i}`] ?? { type: 'cut', durationMs: 0 }}
                      onChange={handleTransitionChange}
                    />
                  )}
                </div>
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none"
          style={{
            width: 4,
            background: 'linear-gradient(to right, var(--surface-1), transparent)',
          }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 pointer-events-none"
          style={{
            width: 4,
            background: 'linear-gradient(to left, var(--surface-1), transparent)',
          }}
        />
      </div>

      <div
        className="flex items-center justify-between px-4 py-1.5 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <span className="text-[8px] font-slate" style={{ color: 'var(--text-muted)' }}>
          Drag clips to reorder · Click splice points for transitions
        </span>
      </div>
    </div>
  )
}
