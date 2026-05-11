'use client'

import { useState } from 'react'
import { Scissors, Blend, Moon, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TransitionType, ClipTransition } from '@/lib/types'

const TRANSITION_OPTIONS: { type: TransitionType; label: string; description: string; icon: React.ReactNode }[] = [
  { type: 'cut', label: 'Cut', description: 'Instant', icon: <Scissors className="w-3.5 h-3.5" /> },
  { type: 'crossfade', label: 'Crossfade', description: 'Blend', icon: <Blend className="w-3.5 h-3.5" /> },
  { type: 'fade_black', label: 'Fade', description: 'To Black', icon: <Moon className="w-3.5 h-3.5" /> },
  { type: 'wipe_left', label: 'Wipe', description: 'Sweep ←', icon: <ChevronLeft className="w-3.5 h-3.5" /> },
  { type: 'wipe_right', label: 'Wipe', description: 'Sweep →', icon: <ChevronRight className="w-3.5 h-3.5" /> },
]

interface TransitionPickerProps {
  current: ClipTransition
  onApply: (transition: ClipTransition) => void
  anchorRect?: DOMRect | null
  onClose: () => void
}

export default function TransitionPicker({ current, onApply, anchorRect, onClose }: TransitionPickerProps) {
  const [selected, setSelected] = useState<TransitionType>(current.type)
  const [durationMs, setDurationMs] = useState(current.durationMs || 500)

  const isCut = selected === 'cut'

  const style: React.CSSProperties = anchorRect
    ? {
        position: 'absolute',
        top: anchorRect.bottom + 6,
        left: Math.max(8, anchorRect.left - 40),
        zIndex: 50,
      }
    : { position: 'relative', zIndex: 50 }

  return (
    <div
      className="rounded border shadow-sm fade-up"
      style={{
        ...style,
        background: 'var(--surface-1)',
        borderColor: 'var(--border-standard)',
        minWidth: 220,
        padding: '12px 12px 10px',
      }}
    >
      <div className="flex items-center justify-between mb-2.5">
        <span
          className="text-[9px] tracking-[0.2em] uppercase font-slate"
          style={{ color: 'var(--text-muted)' }}
        >
          Transition
        </span>
        <button
          onClick={onClose}
          className="text-[10px] font-slate px-1"
          style={{ color: 'var(--text-muted)' }}
        >
          ✕
        </button>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {TRANSITION_OPTIONS.map(opt => {
          const isActive = selected === opt.type
          return (
            <button
              key={opt.type}
              onClick={() => setSelected(opt.type)}
              className="flex flex-col items-center gap-1 py-2 px-1 rounded border transition-all duration-100"
              style={{
                borderColor: isActive ? 'var(--accent-amber)' : 'var(--border-subtle)',
                background: isActive ? 'rgba(170,136,68,0.08)' : 'transparent',
                color: isActive ? 'var(--accent-amber)' : 'var(--text-muted)',
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.6 }}>{opt.icon}</span>
              <span className="text-[8px] tracking-wide uppercase font-slate">{opt.label}</span>
              <span className="text-[7px] font-slate" style={{ color: 'var(--text-muted)' }}>{opt.description}</span>
            </button>
          )
        })}
      </div>

      {!isCut && (
        <div className="mt-3 pt-2.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-slate" style={{ color: 'var(--text-muted)' }}>Duration</span>
            <span className="text-[9px] font-slate tabular-nums" style={{ color: 'var(--accent-amber)' }}>
              {durationMs}ms
            </span>
          </div>
          <input
            type="range"
            min={300}
            max={2000}
            step={100}
            value={durationMs}
            onChange={e => setDurationMs(Number(e.target.value))}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{
              accentColor: 'var(--accent-amber)',
              background: `linear-gradient(to right, var(--accent-amber) ${((durationMs - 300) / 1700) * 100}%, var(--surface-3) ${((durationMs - 300) / 1700) * 100}%)`,
            }}
          />
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => {
            onApply({ type: selected, durationMs: isCut ? 0 : durationMs })
            onClose()
          }}
          className="text-[9px] tracking-[0.15em] uppercase font-slate px-4 py-1.5 rounded border transition-colors duration-150"
          style={{
            borderColor: 'var(--accent-amber)',
            background: 'rgba(170,136,68,0.08)',
            color: 'var(--accent-amber)',
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}
