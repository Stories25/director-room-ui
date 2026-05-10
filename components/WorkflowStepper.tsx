'use client'

import { useRouter } from 'next/navigation'
import { Mic, FileText, LayoutGrid, Film, Music } from 'lucide-react'

export type WorkflowStep = 'story' | 'script' | 'storyboard' | 'video' | 'sound'

interface WorkflowStepperProps {
  current: WorkflowStep
  projectId?: string
}

const STEPS: { key: WorkflowStep; label: string; icon: React.ReactNode; path: (id?: string) => string }[] = [
  { key: 'story', label: 'Story', icon: <Mic className="w-3.5 h-3.5" />, path: () => '/room' },
  { key: 'script', label: 'Script', icon: <FileText className="w-3.5 h-3.5" />, path: () => '/script' },
  { key: 'storyboard', label: 'Storyboard', icon: <LayoutGrid className="w-3.5 h-3.5" />, path: (id) => id ? `/storyboard/${id}` : '/script' },
  { key: 'video', label: 'Video', icon: <Film className="w-3.5 h-3.5" />, path: (id) => id ? `/video/${id}` : '/script' },
  { key: 'sound', label: 'Sound', icon: <Music className="w-3.5 h-3.5" />, path: (id) => id ? `/sound/${id}` : '/script' },
]

const STEP_ORDER: WorkflowStep[] = ['story', 'script', 'storyboard', 'video', 'sound']

function stepIndex(step: WorkflowStep): number {
  return STEP_ORDER.indexOf(step)
}

export default function WorkflowStepper({ current, projectId }: WorkflowStepperProps) {
  const router = useRouter()
  const currentIdx = stepIndex(current)

  return (
    <div className="flex items-center justify-center gap-1 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
      {STEPS.map((step, i) => {
        const isCompleted = currentIdx > i
        const isCurrent = currentIdx === i
        const isUpcoming = currentIdx < i

        return (
          <div key={step.key} className="flex items-center">
            {/* Connector line */}
            {i > 0 && (
              <div
                className="w-6 h-px mx-1.5 transition-colors duration-300"
                style={{ background: isCompleted ? 'var(--accent-amber)' : 'var(--border-subtle)' }}
              />
            )}

            {/* Step node */}
            <button
              onClick={() => {
                if (!isUpcoming && step.key !== current) {
                  router.push(step.path(projectId))
                }
              }}
              disabled={isUpcoming}
              className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all duration-200 ${
                isUpcoming ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
              } ${isCurrent ? 'ring-1' : ''}`}
              style={{
                background: isCurrent ? 'rgba(170,136,68,0.08)' : 'transparent',
                color: isCurrent ? 'var(--accent-amber)' : isCompleted ? 'var(--text-tertiary)' : 'var(--text-muted)',
                borderColor: isCurrent ? 'rgba(170,136,68,0.3)' : 'transparent',
                borderWidth: isCurrent ? 1 : 0,
                borderStyle: 'solid',
              }}
              title={isUpcoming ? 'Complete previous steps first' : `Go to ${step.label}`}
            >
              {/* Icon */}
              <span className={isCurrent ? 'text-amber-400' : ''}>
                {step.icon}
              </span>

              {/* Label */}
              <span className="text-[10px] tracking-[0.15em] uppercase font-slate">
                {step.label}
              </span>

              {/* Status dot */}
              {isCompleted && (
                <span className="h-1 w-1 rounded-full flex-none" style={{ background: 'var(--accent-green)' }} />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
