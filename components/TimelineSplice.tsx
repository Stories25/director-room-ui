'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Scissors, Blend, Moon, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ClipTransition, TransitionType } from '@/lib/types'
import TransitionPicker from './TransitionPicker'

const TYPE_ICONS: Record<TransitionType, React.ReactNode> = {
  cut: <Scissors className="w-2.5 h-2.5" />,
  crossfade: <Blend className="w-2.5 h-2.5" />,
  fade_black: <Moon className="w-2.5 h-2.5" />,
  wipe_left: <ChevronLeft className="w-2.5 h-2.5" />,
  wipe_right: <ChevronRight className="w-2.5 h-2.5" />,
}

interface TimelineSpliceProps {
  index: number
  transition: ClipTransition
  onChange: (index: number, transition: ClipTransition) => void
}

export default function TimelineSplice({ index, transition, onChange }: TimelineSpliceProps) {
  const [showPicker, setShowPicker] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const spliceRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const isCut = transition.type === 'cut'

  const handleClick = useCallback(() => {
    if (spliceRef.current) {
      setAnchorRect(spliceRef.current.getBoundingClientRect())
    }
    setShowPicker(true)
  }, [])

  useEffect(() => {
    if (!showPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(e.target as Node) &&
        spliceRef.current &&
        !spliceRef.current.contains(e.target as Node)
      ) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPicker])

  return (
    <div className="relative flex-none" style={{ width: 24 }} ref={pickerRef}>
      <button
        ref={spliceRef}
        onClick={handleClick}
        className="absolute top-0 bottom-0 flex items-center justify-center transition-colors duration-150"
        style={{
          left: 0,
          right: 0,
          color: isCut ? 'var(--border-emphasis)' : 'var(--accent-amber)',
          opacity: isCut ? 0.6 : 0.9,
        }}
        title={`Transition: ${transition.type}${!isCut ? ` ${transition.durationMs}ms` : ''}`}
      >
        <div
          className="flex flex-col items-center gap-0.5"
          style={{ transform: 'scale(0.75)' }}
        >
          {TYPE_ICONS[transition.type]}
          {!isCut && (
            <span
              className="text-[6px] font-slate tabular-nums"
              style={{ color: 'var(--text-muted)' }}
            >
              {transition.durationMs}
            </span>
          )}
        </div>
      </button>

      {showPicker && (
        <TransitionPicker
          current={transition}
          onApply={t => onChange(index, t)}
          anchorRect={anchorRect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
