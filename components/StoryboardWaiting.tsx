'use client'

import { ScriptDocument } from '@/lib/types'
import { PipelineStep } from '@/lib/pipeline-state'

interface StoryboardWaitingProps {
  script: ScriptDocument
  projectId: string
  currentStep: PipelineStep
  error?: string | null
  onStartOver: () => void
}

const STEPS: { key: PipelineStep; label: string }[] = [
  { key: 'project',    label: 'Project created'      },
  { key: 'script',     label: 'Structuring script'   },
  { key: 'storyboard', label: 'Rendering frames'     },
]

const STEP_ORDER: PipelineStep[] = ['project', 'script', 'storyboard', 'done']

function stepIndex(step: PipelineStep): number {
  return STEP_ORDER.indexOf(step)
}

const CELLS = Array.from({ length: 9 }, (_, i) => i)

export default function StoryboardWaiting({
  script,
  projectId,
  currentStep,
  error,
  onStartOver,
}: StoryboardWaitingProps) {
  const currentIdx = stepIndex(currentStep)
  const showShimmer = currentStep === 'storyboard'

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-10" style={{ background: 'var(--canvas)' }}>

      {/* Title + logline */}
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

      {/* 3×3 shimmer grid — visible during storyboard step only */}
      {showShimmer && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: 'repeat(3, 152px)', gridTemplateRows: 'repeat(3, 96px)' }}
        >
          {CELLS.map(i => (
            <div
              key={i}
              className="rounded-sm overflow-hidden cell-reveal"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div
                className="w-full h-full shimmer"
                style={{ borderRadius: 2, position: 'relative', overflow: 'hidden' }}
              >
                <div
                  className="absolute bottom-1.5 left-2 text-[9px] font-slate"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {Math.floor(i / 3) + 1}.{(i % 3) + 1}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3-step checklist */}
      <div className="flex flex-col items-start gap-3" style={{ minWidth: 220 }}>
        {STEPS.map(({ key, label }) => {
          const idx = stepIndex(key)
          const isDone    = currentIdx > idx
          const isActive  = currentIdx === idx
          const isPending = currentIdx < idx

          return (
            <div key={key} className="flex items-center gap-3">
              {/* Status indicator */}
              <div className="flex-none" style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="6.5" stroke="var(--accent-green)" strokeOpacity="0.5" />
                    <path d="M4 7l2 2 4-4" stroke="var(--accent-green)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isActive ? (
                  <span
                    className="inline-block rounded-full border-t animate-spin"
                    style={{
                      width: 12,
                      height: 12,
                      borderWidth: 1.5,
                      borderColor: 'var(--surface-2)',
                      borderTopColor: 'var(--text-secondary)',
                    }}
                  />
                ) : (
                  <span
                    className="inline-block rounded-full"
                    style={{ width: 6, height: 6, background: 'var(--surface-2)' }}
                  />
                )}
              </div>

              {/* Label */}
              <p
                className={`text-sm font-light font-slate ${isActive ? 'breathe' : ''}`}
                style={{
                  color: isDone
                    ? 'var(--text-tertiary)'
                    : isActive
                    ? 'var(--text-primary)'
                    : 'var(--text-muted)',
                  opacity: isPending ? 0.4 : 1,
                  transition: 'color 0.3s, opacity 0.3s',
                }}
              >
                {label}
                {isDone ? ' ✓' : isActive ? '…' : ''}
              </p>
            </div>
          )
        })}
      </div>

      {/* Project ID — small slate reference */}
      <p className="text-[10px] font-slate tabular-nums" style={{ color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
        {projectId}
      </p>

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center gap-3 text-center" style={{ maxWidth: 360 }}>
          <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
          <button
            onClick={onStartOver}
            className="text-xs tracking-[0.2em] uppercase transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            ← Start over
          </button>
        </div>
      )}

      {/* Attribution */}
      <div className="absolute bottom-6 right-8 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>
        Powered by Runway
      </div>
    </div>
  )
}
