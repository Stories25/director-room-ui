'use client'

import { useEffect, useRef } from 'react'

export interface StoryExtraction {
  character: string | null
  setting: string | null
  tone: string | null
  action: string | null
  arc: string | null
}

interface StoryPanelProps {
  extraction: StoryExtraction
  isExtracting: boolean
}

const FIELDS: { key: keyof StoryExtraction; label: string; hint: string }[] = [
  { key: 'character', label: 'Character', hint: 'Who is the film about?' },
  { key: 'setting',   label: 'Setting',   hint: 'Where and when?' },
  { key: 'tone',      label: 'Tone',      hint: 'What does it feel like?' },
  { key: 'action',    label: 'Action',    hint: 'What happens in 30 seconds?' },
  { key: 'arc',       label: 'Arc',       hint: 'Setup → Moment → Resolution' },
]

export default function StoryPanel({ extraction, isExtracting }: StoryPanelProps) {
  const captured = FIELDS.filter(f => extraction[f.key] !== null).length
  const total = FIELDS.length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-none border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: '#1a1a1a' }}>
        <p className="text-xs tracking-[0.2em] uppercase" style={{ color: '#555' }}>
          Story So Far
        </p>
        <div className="flex items-center gap-2">
          {isExtracting && (
            <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: '#555' }} />
          )}
          <p className="text-xs tabular-nums" style={{ color: captured === total ? '#6a9a6a' : '#444' }}>
            {captured}/{total}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-none h-px w-full" style={{ background: '#111' }}>
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${(captured / total) * 100}%`,
            background: captured === total ? '#4a7a4a' : '#333',
          }}
        />
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {FIELDS.map((field) => {
          const value = extraction[field.key]
          const hasValue = value !== null

          return (
            <div key={field.key} className="space-y-1.5">
              {/* Label row */}
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 w-1.5 rounded-full flex-none transition-colors duration-500"
                  style={{ background: hasValue ? '#5a8a5a' : '#2a2a2a' }}
                />
                <p className="text-[10px] font-medium tracking-[0.25em] uppercase"
                  style={{ color: hasValue ? '#666' : '#333' }}>
                  {field.label}
                </p>
              </div>

              {/* Value or hint */}
              {hasValue ? (
                <p className="text-sm font-light leading-relaxed pl-3.5 fade-up"
                  style={{ color: '#c8c8c8' }}>
                  {value}
                </p>
              ) : (
                <p className="text-xs italic pl-3.5" style={{ color: '#2a2a2a' }}>
                  {field.hint}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer — when complete */}
      {captured === total && (
        <div className="flex-none border-t px-6 py-4 fade-up" style={{ borderColor: '#1a1a1a' }}>
          <p className="text-xs text-center" style={{ color: '#5a8a5a' }}>
            Story captured — ready to finish
          </p>
        </div>
      )}
    </div>
  )
}
