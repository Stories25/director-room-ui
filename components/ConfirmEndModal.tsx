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
  const missing = (Object.keys(extraction) as (keyof StoryExtraction)[]).filter(
    k => extraction[k] === null
  )

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div
        className="w-full max-w-md rounded border p-8 space-y-6"
        style={{ background: 'var(--surface-1)', borderColor: 'var(--border-standard)' }}
      >
        {/* Title */}
        <div className="space-y-1">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            End session and generate script?
          </p>
          <p className="text-xs font-light" style={{ color: 'var(--text-muted)' }}>
            Review what has been captured before finishing.
          </p>
        </div>

        {/* Captured fields */}
        <div className="space-y-3">
          {(Object.keys(extraction) as (keyof StoryExtraction)[]).map(key => {
            const value = extraction[key]
            return (
              <div key={key} className="flex gap-3">
                <div className="flex-none mt-1">
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: value ? 'var(--accent-green)' : 'var(--text-muted)' }}
                  />
                </div>
                <div>
                  <p className="text-[10px] tracking-[0.2em] uppercase mb-0.5"
                    style={{ color: value ? 'var(--text-tertiary)' : 'var(--text-muted)' }}>
                    {FIELD_LABELS[key]}
                  </p>
                  {value ? (
                    <p className="text-xs font-light leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {value}
                    </p>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      Not captured yet
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Warning */}
        {missing.length > 0 && (
          <div className="rounded border px-4 py-3" style={{ borderColor: 'rgba(170,136,68,0.2)', background: 'rgba(170,136,68,0.05)' }}>
            <p className="text-xs" style={{ color: 'var(--accent-warm)' }}>
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
            className="flex-1 border py-2.5 text-xs tracking-[0.2em] uppercase transition-all duration-150"
            style={{ borderColor: 'var(--border-standard)', color: 'var(--text-tertiary)', borderRadius: 2 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-emphasis)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-standard)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            Keep going
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-xs font-medium tracking-[0.2em] uppercase transition-all duration-150"
            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)', borderRadius: 2 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fff' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--text-primary)' }}
          >
            Generate Script
          </button>
        </div>
      </div>
    </div>
  )
}
