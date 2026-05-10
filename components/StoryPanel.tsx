'use client'

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
        style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--text-tertiary)' }}>
          Story So Far
        </p>
        <div className="flex items-center gap-2">
          {isExtracting && (
            <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--text-tertiary)' }} />
          )}
          <p className="text-xs tabular-nums font-slate" style={{ color: captured === total ? 'var(--accent-green)' : 'var(--text-tertiary)' }}>
            {captured}/{total}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-none h-px w-full" style={{ background: 'var(--surface-2)' }}>
        <div
          className="h-full transition-all duration-700"
          style={{
            width: `${(captured / total) * 100}%`,
            background: captured === total ? 'var(--accent-green)' : 'var(--text-muted)',
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
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 w-1.5 rounded-full flex-none transition-colors duration-500"
                  style={{ background: hasValue ? 'var(--accent-green)' : 'var(--text-muted)' }}
                />
                <p className="text-[10px] font-medium tracking-[0.25em] uppercase"
                  style={{ color: hasValue ? 'var(--text-tertiary)' : 'var(--text-muted)' }}>
                  {field.label}
                </p>
              </div>

              {hasValue ? (
                <p className="text-sm font-light leading-relaxed pl-3.5 fade-up"
                  style={{ color: 'var(--text-secondary)' }}>
                  {value}
                </p>
              ) : (
                <p className="text-xs italic pl-3.5" style={{ color: 'var(--text-muted)' }}>
                  {field.hint}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {captured === total && (
        <div className="flex-none border-t px-6 py-4 fade-up" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs text-center" style={{ color: 'var(--accent-green)' }}>
            Story captured — ready to finish
          </p>
        </div>
      )}
    </div>
  )
}
