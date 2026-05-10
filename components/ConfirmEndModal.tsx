'use client'

import { StoryExtraction } from './StoryPanel'

interface ConfirmEndModalProps {
  extraction: StoryExtraction
  onConfirm: () => void
  onCancel: () => void
}

const FIELD_LABELS: Record<keyof StoryExtraction, string> = {
  character: 'Character',
  setting: 'Setting',
  tone: 'Tone',
  action: 'Action',
  arc: 'Narrative Arc',
}

export default function ConfirmEndModal({ extraction, onConfirm, onCancel }: ConfirmEndModalProps) {
  const captured = Object.values(extraction).filter(v => v !== null)
  const missing = (Object.keys(extraction) as (keyof StoryExtraction)[]).filter(
    k => extraction[k] === null
  )

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div
        className="w-full max-w-md rounded border p-8 space-y-6"
        style={{ background: '#0e0e0e', borderColor: '#222' }}
      >
        {/* Title */}
        <div className="space-y-1">
          <p className="text-sm font-medium" style={{ color: '#e0e0e0' }}>
            End session and generate script?
          </p>
          <p className="text-xs font-light" style={{ color: '#444' }}>
            Review what has been captured before finishing.
          </p>
        </div>

        {/* Captured */}
        <div className="space-y-3">
          {(Object.keys(extraction) as (keyof StoryExtraction)[]).map(key => {
            const value = extraction[key]
            return (
              <div key={key} className="flex gap-3">
                <div className="flex-none mt-1">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: value ? '#5a8a5a' : '#2a2a2a' }}
                  />
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase mb-0.5"
                    style={{ color: value ? '#555' : '#2a2a2a' }}>
                    {FIELD_LABELS[key]}
                  </p>
                  {value ? (
                    <p className="text-xs font-light leading-relaxed" style={{ color: '#aaa' }}>
                      {value}
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: '#2a2a2a' }}>
                      Not captured yet
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Warning if missing fields */}
        {missing.length > 0 && (
          <div className="rounded border px-4 py-3" style={{ borderColor: '#3a2a1a', background: '#1a1208' }}>
            <p className="text-xs" style={{ color: '#8a6a3a' }}>
              {missing.length} area{missing.length > 1 ? 's' : ''} not yet discussed:{' '}
              {missing.map(k => FIELD_LABELS[k]).join(', ')}.
              The AI will infer these from context.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 border py-2.5 text-xs tracking-widest uppercase transition-all duration-150"
            style={{ borderColor: '#222', color: '#555' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#aaa' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' }}
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-xs font-medium tracking-widest uppercase transition-all duration-150"
            style={{ background: '#e8e8e8', color: '#080808', borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#e8e8e8' }}
          >
            Generate Script
          </button>
        </div>
      </div>
    </div>
  )
}
