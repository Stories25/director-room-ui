'use client'

import { ScriptDocument } from '@/lib/types'

interface ScriptDocumentProps {
  script: ScriptDocument
  onChange: (updated: ScriptDocument) => void
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-medium tracking-[0.25em] uppercase" style={{ color: '#555' }}>
      {children}
    </p>
  )
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
}) {
  const sharedStyle: React.CSSProperties = {
    color: '#e0e0e0',
    background: '#111',
    borderColor: '#222',
    caretColor: '#fff',
    borderRadius: 4,
  }

  return (
    <div>
      <Label>{label}</Label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full resize-none border px-3 py-2.5 text-sm font-light leading-relaxed outline-none transition-colors duration-150"
          style={sharedStyle}
          onFocus={(e) => (e.target.style.borderColor = '#444')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border px-3 py-2.5 text-sm font-light outline-none transition-colors duration-150"
          style={sharedStyle}
          onFocus={(e) => (e.target.style.borderColor = '#444')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
      )}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <p className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: '#888' }}>
        {children}
      </p>
      <div className="flex-1 h-px" style={{ background: '#1e1e1e' }} />
    </div>
  )
}

export default function ScriptDocumentView({ script, onChange }: ScriptDocumentProps) {
  const update = (patch: Partial<ScriptDocument>) => onChange({ ...script, ...patch })
  const updateScene = (patch: Partial<ScriptDocument['scene']>) =>
    onChange({ ...script, scene: { ...script.scene, ...patch } })

  return (
    <div className="space-y-10">

      {/* ── Title & Logline ── */}
      <div className="space-y-5">
        <Field label="Title" value={script.title} onChange={(v) => update({ title: v })} />
        <Field label="Logline" value={script.logline} onChange={(v) => update({ logline: v })} multiline rows={2} />
      </div>

      {/* ── Meta row ── */}
      <div className="grid grid-cols-3 gap-4">
        <Field label="Genre" value={script.genre} onChange={(v) => update({ genre: v })} />
        <Field label="Tone" value={script.tone} onChange={(v) => update({ tone: v })} />
        <div>
          <Label>Duration</Label>
          <div
            className="border px-3 py-2.5 text-sm font-light"
            style={{ borderColor: '#222', color: '#555', background: '#0d0d0d', borderRadius: 4 }}
          >
            30 seconds
          </div>
        </div>
      </div>

      {/* ── Characters ── */}
      <div>
        <SectionHeading>Characters</SectionHeading>
        <div className="space-y-6">
          {script.characters.map((char, i) => (
            <div
              key={i}
              className="rounded border p-5 space-y-4"
              style={{ borderColor: '#1e1e1e', background: '#0d0d0d' }}
            >
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Name"
                  value={char.name}
                  onChange={(v) => {
                    const chars = [...script.characters]
                    chars[i] = { ...chars[i], name: v }
                    update({ characters: chars })
                  }}
                />
                <Field
                  label="Role"
                  value={char.role}
                  onChange={(v) => {
                    const chars = [...script.characters]
                    chars[i] = { ...chars[i], role: v as ScriptDocument['characters'][0]['role'] }
                    update({ characters: chars })
                  }}
                />
              </div>
              <Field
                label="Description"
                value={char.description}
                onChange={(v) => {
                  const chars = [...script.characters]
                  chars[i] = { ...chars[i], description: v }
                  update({ characters: chars })
                }}
                multiline
                rows={2}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Scene ── */}
      <div>
        <SectionHeading>Scene</SectionHeading>
        <div
          className="rounded border p-5 space-y-5"
          style={{ borderColor: '#1e1e1e', background: '#0d0d0d' }}
        >
          <div className="grid grid-cols-3 gap-4">
            <Field label="Setting" value={script.scene.setting} onChange={(v) => updateScene({ setting: v })} />
            <Field label="Time of Day" value={script.scene.time_of_day} onChange={(v) => updateScene({ time_of_day: v })} />
            <Field label="Mood" value={script.scene.mood} onChange={(v) => updateScene({ mood: v })} />
          </div>
          <Field label="Action" value={script.scene.action} onChange={(v) => updateScene({ action: v })} multiline rows={4} />

          {/* Dialogue Hints */}
          <div>
            <Label>Dialogue Hints</Label>
            <div className="space-y-2">
              {script.scene.dialogue_hints.map((hint, i) => (
                <input
                  key={i}
                  type="text"
                  value={hint}
                  onChange={(e) => {
                    const hints = [...script.scene.dialogue_hints]
                    hints[i] = e.target.value
                    updateScene({ dialogue_hints: hints })
                  }}
                  className="w-full border px-3 py-2 text-sm font-light outline-none transition-colors duration-150"
                  style={{ color: '#e0e0e0', background: '#111', borderColor: '#222', borderRadius: 4, caretColor: '#fff' }}
                  onFocus={(e) => (e.target.style.borderColor = '#444')}
                  onBlur={(e) => (e.target.style.borderColor = '#222')}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Style + Narrative Arc ── */}
      <div>
        <SectionHeading>Direction</SectionHeading>
        <div className="space-y-5">
          <Field label="Visual Style" value={script.visual_style} onChange={(v) => update({ visual_style: v })} multiline rows={3} />
          <Field label="Narrative Arc" value={script.narrative_arc} onChange={(v) => update({ narrative_arc: v })} multiline rows={3} />
        </div>
      </div>

    </div>
  )
}
