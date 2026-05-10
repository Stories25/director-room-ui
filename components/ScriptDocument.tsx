'use client'

import { ScriptDocument, Shot, ShotType, LocationType } from '@/lib/types'

interface ScriptDocumentProps {
  script: ScriptDocument
  onChange: (updated: ScriptDocument) => void
}

// ── Film strip timeline ──────────────────────────────────────────────────────

function Timeline({ shots }: { shots: Shot[] }) {
  const total = shots.reduce((s, sh) => s + sh.duration_seconds, 0)
  // Film-stock colors for each shot "frame"
  const frameColors = [
    'rgba(90,138,90,0.25)', 'rgba(90,120,138,0.25)', 'rgba(138,90,90,0.25)',
    'rgba(138,120,90,0.25)', 'rgba(90,90,138,0.25)', 'rgba(120,138,90,0.25)',
    'rgba(138,90,120,0.25)',
  ]

  return (
    <div className="space-y-3">
      {/* Film strip bar with sprocket edges */}
      <div className="relative">
        {/* Sprocket holes top */}
        <div className="flex gap-2 mb-1 px-1">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="rounded-full" style={{ width: 3, height: 3, background: 'var(--border-subtle)' }} />
          ))}
        </div>

        {/* Bar */}
        <div className="flex h-8 overflow-hidden gap-px rounded-sm" style={{ background: 'var(--surface-1)' }}>
          {shots.map((shot, i) => {
            const width = total > 0 ? (shot.duration_seconds / total) * 100 : 100 / shots.length
            return (
              <div
                key={i}
                className="relative flex items-center justify-center group cursor-default transition-opacity duration-150 hover:opacity-80"
                style={{ width: `${width}%`, background: frameColors[i % frameColors.length] }}
                title={`Shot ${shot.number}: ${shot.action?.slice(0, 60)}...`}
              >
                <span className="text-[9px] font-medium tabular-nums font-slate" style={{ color: 'var(--text-tertiary)' }}>
                  {shot.duration_seconds}s
                </span>
              </div>
            )
          })}
        </div>

        {/* Sprocket holes bottom */}
        <div className="flex gap-2 mt-1 px-1">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="rounded-full" style={{ width: 3, height: 3, background: 'var(--border-subtle)' }} />
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>0s</span>
        <span className="text-[10px] font-slate" style={{ color: total === 30 ? 'var(--accent-green)' : 'var(--accent-warm)' }}>
          {total}s {total !== 30 && `(target: 30s)`}
        </span>
      </div>

      {/* Shot labels */}
      <div className="flex gap-4 flex-wrap">
        {shots.map((shot, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-sm flex-none" style={{ background: frameColors[i % frameColors.length] }} />
            <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
              {shot.number}. {shot.shot_type} · {shot.duration_seconds}s
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Inline editable field ───────────────────────────────────────────────────

function Editable({
  value,
  onChange,
  multiline = false,
  className = '',
  style = {},
  rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  className?: string
  style?: React.CSSProperties
  rows?: number
}) {
  const base: React.CSSProperties = {
    background: 'transparent',
    outline: 'none',
    caretColor: 'var(--text-primary)',
    borderBottom: '1px solid transparent',
    transition: 'border-color 0.15s',
    width: '100%',
    ...style,
  }
  if (multiline) return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      className={`resize-none ${className}`}
      style={base}
      onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-amber)')}
      onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
    />
  )
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
      style={base}
      onFocus={e => (e.target.style.borderBottomColor = 'var(--accent-amber)')}
      onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
    />
  )
}

// ── Shot card — shooting script style ────────────────────────────────────────

function ShotCard({
  shot,
  onChange,
}: {
  shot: Shot
  onChange: (updated: Shot) => void
}) {
  const upd = (patch: Partial<Shot>) => onChange({ ...shot, ...patch })

  return (
    <div
      className="border-l-2 pl-5 py-4 space-y-3"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      {/* Slugline */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Shot number — large, like a film frame number */}
        <span
          className="text-xs font-slate font-semibold px-2 py-0.5 rounded"
          style={{ background: 'var(--surface-2)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}
        >
          {shot.number}
        </span>

        {/* INT/EXT */}
        <select
          value={shot.location_type}
          onChange={e => upd({ location_type: e.target.value as LocationType })}
          className="text-xs font-slate font-semibold uppercase bg-transparent outline-none cursor-pointer"
          style={{ color: 'var(--text-secondary)', border: 'none' }}
        >
          <option value="INT">INT.</option>
          <option value="EXT">EXT.</option>
        </select>

        {/* Location */}
        <Editable
          value={shot.location}
          onChange={v => upd({ location: v })}
          className="text-xs font-slate font-semibold uppercase flex-1"
          style={{ color: 'var(--text-secondary)', minWidth: 120 }}
        />

        {/* Time separator */}
        <span className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>—</span>

        {/* Time of day */}
        <Editable
          value={shot.time_of_day}
          onChange={v => upd({ time_of_day: v })}
          className="text-xs font-slate uppercase"
          style={{ color: 'var(--text-secondary)', width: 90 }}
        />

        {/* Shot type */}
        <select
          value={shot.shot_type}
          onChange={e => upd({ shot_type: e.target.value as ShotType })}
          className="text-xs uppercase bg-transparent outline-none cursor-pointer ml-auto font-slate"
          style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '1px 6px' }}
        >
          {(['ECU','CU','MCU','MS','WS','EWS','POV','INSERT'] as ShotType[]).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Duration */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={2}
            max={10}
            value={shot.duration_seconds}
            onChange={e => upd({ duration_seconds: Number(e.target.value) })}
            className="text-xs tabular-nums text-right bg-transparent outline-none w-6 font-slate"
            style={{ color: 'var(--text-tertiary)', border: 'none' }}
          />
          <span className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>s</span>
        </div>
      </div>

      {/* Action block */}
      <Editable
        value={shot.action}
        onChange={v => upd({ action: v })}
        multiline
        rows={2}
        className="text-sm font-light leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      />

      {/* Dialogue — indented block with left border */}
      {shot.dialogue !== undefined && (
        <div className="pl-6 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
            Dialogue
          </p>
          <Editable
            value={shot.dialogue}
            onChange={v => upd({ dialogue: v })}
            className="text-sm italic font-light"
            style={{ color: 'var(--text-secondary)' }}
          />
        </div>
      )}

      {/* Direction note */}
      {shot.direction !== undefined && (
        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
          ({shot.direction})
        </p>
      )}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function ScriptDocumentView({ script, onChange }: ScriptDocumentProps) {
  const update = (patch: Partial<ScriptDocument>) => onChange({ ...script, ...patch })
  const shots = script.shots || []

  const updateShot = (i: number, updated: Shot) => {
    const next = [...shots]
    next[i] = updated
    update({ shots: next })
  }

  return (
    <div className="space-y-12">

      {/* ── Header — film title card style ── */}
      <div className="space-y-6">
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Title</p>
          <Editable
            value={script.title}
            onChange={v => update({ title: v })}
            className="text-2xl font-light tracking-tight"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          />
        </div>

        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Logline</p>
          <Editable
            value={script.logline}
            onChange={v => update({ logline: v })}
            multiline
            rows={2}
            className="text-sm font-light leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          />
        </div>

        {/* Meta pills */}
        <div className="flex gap-4 flex-wrap">
          {[
            { label: 'Genre', value: script.genre, key: 'genre' as const },
            { label: 'Tone',  value: script.tone,  key: 'tone'  as const },
          ].map(({ label, value, key }) => (
            <div key={key} className="flex items-center gap-2 rounded border px-3 py-1.5"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
              <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</span>
              <Editable
                value={value}
                onChange={v => update({ [key]: v })}
                className="text-xs"
                style={{ color: 'var(--text-tertiary)', width: 100 }}
              />
            </div>
          ))}
          <div className="flex items-center gap-2 rounded border px-3 py-1.5"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)' }}>Duration</span>
            <span className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>30 seconds</span>
          </div>
        </div>
      </div>

      {/* ── Film strip timeline ── */}
      {shots.length > 0 && (
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase mb-4" style={{ color: 'var(--text-muted)' }}>
            Timeline
          </p>
          <Timeline shots={shots} />
        </div>
      )}

      {/* ── Characters ── */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: 'var(--text-tertiary)' }}>Characters</p>
          <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        </div>
        <div className="space-y-4">
          {script.characters.map((char, i) => (
            <div key={i} className="rounded border p-4 space-y-3"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
              <div className="flex items-center gap-4">
                <span className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded font-slate"
                  style={{
                    background: char.role === 'protagonist' ? 'rgba(90,138,90,0.15)' : 'rgba(90,90,138,0.15)',
                    color: char.role === 'protagonist' ? 'var(--accent-green)' : '#5a5a7a',
                    border: `1px solid ${char.role === 'protagonist' ? 'rgba(90,138,90,0.3)' : 'rgba(90,90,138,0.3)'}`,
                  }}>
                  {char.role}
                </span>
                <Editable
                  value={char.name}
                  onChange={v => {
                    const chars = [...script.characters]
                    chars[i] = { ...chars[i], name: v }
                    update({ characters: chars })
                  }}
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)', flex: 1 }}
                />
              </div>
              <Editable
                value={char.description}
                onChange={v => {
                  const chars = [...script.characters]
                  chars[i] = { ...chars[i], description: v }
                  update({ characters: chars })
                }}
                multiline
                rows={2}
                className="text-xs font-light leading-relaxed"
                style={{ color: 'var(--text-tertiary)' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Shot list — shooting script style ── */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: 'var(--text-tertiary)' }}>Shot List</p>
          <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          <p className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>{shots.length} shots</p>
        </div>
        <div className="space-y-0">
          {shots.map((shot, i) => (
            <ShotCard key={i} shot={shot} onChange={updated => updateShot(i, updated)} />
          ))}
        </div>
      </div>

      {/* ── Direction ── */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: 'var(--text-tertiary)' }}>Direction</p>
          <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
        </div>
        <div className="space-y-5">
          {[
            { label: 'Visual Style',  value: script.visual_style,  key: 'visual_style'  as const },
            { label: 'Narrative Arc', value: script.narrative_arc, key: 'narrative_arc' as const },
          ].map(({ label, value, key }) => (
            <div key={key}>
              <p className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <Editable
                value={value}
                onChange={v => update({ [key]: v })}
                multiline
                rows={3}
                className="text-sm font-light leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
