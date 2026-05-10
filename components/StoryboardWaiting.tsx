'use client'

import { useEffect, useState } from 'react'
import { ScriptDocument } from '@/lib/types'

interface StoryboardWaitingProps {
  script: ScriptDocument
}

const PIPELINE_STEPS = [
  { label: 'Creating your project',    duration: 4  },
  { label: 'Structuring the script',   duration: 8  },
  { label: 'Analysing shots',          duration: 6  },
  { label: 'Generating storyboard',    duration: 55 },
  { label: 'Rendering frames',         duration: 20 },
]

const CELLS = Array.from({ length: 9 }, (_, i) => i)

export default function StoryboardWaiting({ script }: StoryboardWaitingProps) {
  const [elapsed, setElapsed] = useState(0)
  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Derive step index directly from elapsed
  const stepIndex = (() => {
    let acc = 0
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      acc += PIPELINE_STEPS[i].duration
      if (elapsed < acc) return i
    }
    return PIPELINE_STEPS.length - 1
  })()

  // Derive revealed cells directly from elapsed
  const revealedCells = elapsed === 0
    ? []
    : Array.from({ length: Math.min(Math.floor(elapsed / 6) + 1, CELLS.length) }, (_, i) => i)

  const totalDuration = PIPELINE_STEPS.reduce((s, p) => s + p.duration, 0)
  const progress = Math.min((elapsed / totalDuration) * 100, 95)
  const currentStep = PIPELINE_STEPS[stepIndex]

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-10" style={{ background: 'var(--canvas)' }}>

      {/* Title + logline — like a slate on the processing bench */}
      <div className="text-center space-y-2">
        <p className="text-xs tracking-[0.3em] uppercase font-slate" style={{ color: 'var(--text-muted)' }}>
          Processing
        </p>
        <p className="text-lg font-light" style={{ color: 'var(--text-primary)', maxWidth: 480 }}>
          {script.title}
        </p>
        <p className="text-xs font-light leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 420 }}>
          {script.logline}
        </p>
      </div>

      {/* 3×3 grid — frames developing in chemical bath */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(3, 152px)', gridTemplateRows: 'repeat(3, 96px)' }}
      >
        {CELLS.map(i => {
          const isRevealed = revealedCells.includes(i)
          return (
            <div
              key={i}
              className={`rounded-sm overflow-hidden ${isRevealed ? 'cell-reveal' : ''}`}
              style={{
                opacity: isRevealed ? undefined : 0.3,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div
                className={`w-full h-full ${isRevealed ? 'shimmer' : ''}`}
                style={{
                  background: isRevealed ? undefined : 'var(--surface-1)',
                  borderRadius: 2,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isRevealed && (
                  <div
                    className="absolute bottom-1.5 left-2 text-[9px] font-slate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {Math.floor(i / 3) + 1}.{(i % 3) + 1}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Current step — chemical processing log style */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-light breathe font-slate" style={{ color: 'var(--text-secondary)' }}>
          {currentStep?.label}...
        </p>

        {/* Progress bar — green tint like developer fluid */}
        <div className="w-64 h-px overflow-hidden rounded-sm" style={{ background: 'var(--surface-2)' }}>
          <div
            className="h-full transition-all duration-1000"
            style={{ background: 'var(--accent-green)', width: `${progress}%`, opacity: 0.6 }}
          />
        </div>

        <p className="text-xs tabular-nums font-slate" style={{ color: 'var(--text-muted)' }}>
          {elapsed < 10
            ? 'This takes 60–90 seconds'
            : `~${Math.max(0, totalDuration - elapsed)}s remaining`}
        </p>
      </div>

      {/* Runway attribution */}
      <div className="absolute bottom-6 right-8 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>
        Powered by Runway
      </div>
    </div>
  )
}
