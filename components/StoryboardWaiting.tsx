'use client'

import { useEffect, useState } from 'react'
import { ScriptDocument } from '@/lib/types'

interface StoryboardWaitingProps {
  script: ScriptDocument
}

// Steps the pipeline goes through — shown sequentially
const PIPELINE_STEPS = [
  { label: 'Creating your project',    duration: 4  },
  { label: 'Structuring the script',   duration: 8  },
  { label: 'Analysing shots',          duration: 6  },
  { label: 'Generating storyboard',    duration: 55 },
  { label: 'Rendering frames',         duration: 20 },
]

// 9 cells for a 3x3 grid
const CELLS = Array.from({ length: 9 }, (_, i) => i)

export default function StoryboardWaiting({ script }: StoryboardWaitingProps) {
  const [elapsed, setElapsed]         = useState(0)
  const [revealedCells, setRevealed]  = useState<number[]>([])
  const [stepIndex, setStepIndex]     = useState(0)

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Advance pipeline step label
  useEffect(() => {
    let acc = 0
    for (let i = 0; i < PIPELINE_STEPS.length; i++) {
      acc += PIPELINE_STEPS[i].duration
      if (elapsed < acc) { setStepIndex(i); break }
    }
  }, [elapsed])

  // Sequentially reveal cells — one every ~6s, cycling to simulate "drawing"
  useEffect(() => {
    if (elapsed === 0) return
    const cellIdx = Math.min(Math.floor(elapsed / 6), CELLS.length - 1)
    setRevealed(prev => {
      const next = Array.from({ length: cellIdx + 1 }, (_, i) => i)
      return next
    })
  }, [elapsed])

  const totalDuration = PIPELINE_STEPS.reduce((s, p) => s + p.duration, 0)
  const progress = Math.min((elapsed / totalDuration) * 100, 95)
  const currentStep = PIPELINE_STEPS[stepIndex]

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-10 bg-[#080808]">

      {/* Title + logline */}
      <div className="text-center space-y-2">
        <p className="text-xs tracking-[0.3em] uppercase" style={{ color: '#333' }}>
          Building your film
        </p>
        <p className="text-lg font-light" style={{ color: '#c0c0c0', maxWidth: 480 }}>
          {script.title}
        </p>
        <p className="text-xs font-light leading-relaxed" style={{ color: '#3a3a3a', maxWidth: 420 }}>
          {script.logline}
        </p>
      </div>

      {/* 3×3 storyboard skeleton grid */}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(3, 152px)', gridTemplateRows: 'repeat(3, 96px)' }}
      >
        {CELLS.map(i => {
          const isRevealed = revealedCells.includes(i)
          return (
            <div
              key={i}
              className={`rounded overflow-hidden ${isRevealed ? 'cell-reveal' : ''}`}
              style={{
                opacity: isRevealed ? undefined : 0.3,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div
                className={`w-full h-full ${isRevealed ? 'shimmer' : ''}`}
                style={{
                  background: isRevealed ? undefined : '#111',
                  borderRadius: 4,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Shot number label */}
                {isRevealed && (
                  <div
                    className="absolute bottom-1.5 left-2 text-[9px] font-mono"
                    style={{ color: '#333' }}
                  >
                    {Math.floor(i / 3) + 1}.{(i % 3) + 1}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Current step label */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-sm font-light breathe" style={{ color: '#666' }}>
          {currentStep?.label}...
        </p>

        {/* Progress bar */}
        <div className="w-64 h-px overflow-hidden" style={{ background: '#1a1a1a' }}>
          <div
            className="h-full transition-all duration-1000"
            style={{ background: '#333', width: `${progress}%` }}
          />
        </div>

        <p className="text-xs tabular-nums" style={{ color: '#2a2a2a' }}>
          {elapsed < 10
            ? 'This takes 60–90 seconds'
            : `~${Math.max(0, totalDuration - elapsed)}s remaining`}
        </p>
      </div>

      {/* Runway attribution */}
      <div className="absolute bottom-6 right-8 text-xs pointer-events-none" style={{ color: '#1a1a1a' }}>
        Powered by Runway
      </div>
    </div>
  )
}
