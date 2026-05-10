'use client'

import { ScriptDocument, Shot, ShotType, LocationType } from '@/lib/types'

interface ScriptDocumentProps {
  script: ScriptDocument
  onChange: (updated: ScriptDocument) => void
}

// ── 30-second timeline ──────────────────────────────────────────────────────

function Timeline({ shots }: { shots: Shot[] }) {
  const total = shots.reduce((s, sh) => s + sh.duration_seconds, 0)
  const arcColors = ['#2a3a2a', '#2a3530', '#1e2a35', '#2a2a3a', '#352a2a', '#3a2a2a', '#35302a']

  return (
    <div className="space-y-3">
      {/* Bar */}
      <div className="flex h-8 rounded overflow-hidden gap-px" style={{ background: '#0d0d0d' }}>
        {shots.map((shot, i) => {
          const width = total > 0 ? (shot.duration_seconds / total) * 100 : 100 / shots.length
          return (
            <div
              key={i}
              className="relative flex items-center justify-center group cursor-default transition-opacity duration-150 hover:opacity-80"
              style={{ width: `${width}%`, background: arcColors[i % arcColors.length] }}
              title={`Shot ${shot.number}: ${shot.action?.slice(0, 60)}...`}
            >
              <span className="text-[9px] font-medium tabular-nums" style={{ color: '#666' }}>
                {shot.duration_seconds}s
              </span>
            </div>
          )
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between">
        <span className="text-[10px]" style={{ color: '#333' }}>0s</span>
        <span className="text-[10px]" style={{ color: total === 30 ? '#5a8a5a' : '#aa5533' }}>
          {total}s {total !== 30 && `(target: 30s)`}
        </span>
      </div>

      {/* Shot labels below bar */}
      <div className="flex gap-4 flex-wrap">
        {shots.map((shot, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-sm flex-none" style={{ background: arcColors[i % arcColors.length] }} />
            <span className="text-[10px]" style={{ color: '#3a3a3a' }}>
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
    caretColor: '#fff',
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
      onFocus={e => (e.target.style.borderBottomColor = '#333')}
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
      onFocus={e => (e.target.style.borderBottomColor = '#333')}
      onBlur={e => (e.target.style.borderBottomColor = 'transparent')}
    />
  )
}

// ── Shot card ───────────────────────────────────────────────────────────────

function ShotCard({
  shot,
  index,
  onChange,
}: {
  shot: Shot
  index: number
  onChange: (updated: Shot) => void
}) {
  const upd = (patch: Partial<Shot>) => onChange({ ...shot, ...patch })

  return (
    <div
      className="rounded border p-5 space-y-3"
      style={{ borderColor: '#1a1a1a', background: '#0c0c0c' }}
    >
      {/* Slugline row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Shot number badge */}
        <span
          className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
          style={{ background: '#161616', color: '#555', border: '1px solid #222' }}
        >
          {shot.number}
        </span>

        {/* INT/EXT toggle */}
        <select
          value={shot.location_type}
          onChange={e => upd({ location_type: e.target.value as LocationType })}
          className="text-xs font-mono font-semibold uppercase bg-transparent outline-none cursor-pointer"
          style={{ color: '#888', border: 'none' }}
        >
          <option value="INT">INT.</option>
          <option value="EXT">EXT.</option>
        </select>

        {/* Location */}
        <Editable
          value={shot.location}
          onChange={v => upd({ location: v })}
          className="text-xs font-mono font-semibold uppercase flex-1"
          style={{ color: '#c0c0c0', minWidth: 120 }}
        />

        {/* Time of day */}
        <span className="text-xs font-mono" style={{ color: '#555' }}>—</span>
        <Editable
          value={shot.time_of_day}
          onChange={v => upd({ time_of_day: v })}
          className="text-xs font-mono uppercase"
          style={{ color: '#888', width: 90 }}
        />

        {/* Shot type */}
        <select
          value={shot.shot_type}
          onChange={e => upd({ shot_type: e.target.value as ShotType })}
          className="text-xs uppercase bg-transparent outline-none cursor-pointer ml-auto"
          style={{ color: '#555', border: '1px solid #1a1a1a', borderRadius: 3, padding: '1px 6px' }}
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
            className="text-xs tabular-nums text-right bg-transparent outline-none w-6"
            style={{ color: '#666', border: 'none' }}
          />
          <span className="text-xs" style={{ color: '#333' }}>s</span>
        </div>
      </div>

      {/* Action */}
      <Editable
        value={shot.action}
        onChange={v => upd({ action: v })}
        multiline
        rows={2}
        className="text-sm font-light leading-relaxed"
        style={{ color: '#c8c8c8' }}
      />

      {/* Dialogue */}
      {shot.dialogue !== undefined && (
        <div className="pl-8 border-l" style={{ borderColor: '#1e1e1e' }}>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ color: '#333' }}>
            Dialogue
          </p>
          <Editable
            value={shot.dialogue}
            onChange={v => upd({ dialogue: v })}
            className="text-sm italic font-light"
            style={{ color: '#888' }}
          />
        </div>
      )}

      {/* Direction */}
      {shot.direction !== undefined && (
        <p className="text-xs italic" style={{ color: '#3a3a3a' }}>
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
    <div className="space-y-10">

      {/* ── Header ── */}
      <div className="space-y-5">
        {/* Title — large, prominent */}
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: '#333' }}>Title</p>
          <Editable
            value={script.title}
            onChange={v => update({ title: v })}
            className="text-2xl font-light tracking-tight"
            style={{ color: '#f0f0f0', letterSpacing: '-0.01em' }}
          />
        </div>

        {/* Logline */}
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: '#333' }}>Logline</p>
          <Editable
            value={script.logline}
            onChange={v => update({ logline: v })}
            multiline
            rows={2}
            className="text-sm font-light leading-relaxed"
            style={{ color: '#888' }}
          />
        </div>

        {/* Meta pills */}
        <div className="flex gap-4 flex-wrap">
          {[
            { label: 'Genre', value: script.genre, key: 'genre' as const },
            { label: 'Tone',  value: script.tone,  key: 'tone'  as const },
          ].map(({ label, value, key }) => (
            <div key={key} className="flex items-center gap-2 rounded border px-3 py-1.5"
              style={{ borderColor: '#1e1e1e', background: '#0d0d0d' }}>
              <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: '#333' }}>{label}</span>
              <Editable
                value={value}
                onChange={v => update({ [key]: v })}
                className="text-xs"
                style={{ color: '#777', width: 100 }}
              />
            </div>
          ))}
          <div className="flex items-center gap-2 rounded border px-3 py-1.5"
            style={{ borderColor: '#1e1e1e', background: '#0d0d0d' }}>
            <span className="text-[10px] tracking-[0.2em] uppercase" style={{ color: '#333' }}>Duration</span>
            <span className="text-xs" style={{ color: '#555' }}>30 seconds</span>
          </div>
        </div>
      </div>

      {/* ── 30-second timeline ── */}
      {shots.length > 0 && (
        <div>
          <p className="text-[10px] tracking-[0.25em] uppercase mb-4" style={{ color: '#333' }}>
            Timeline
          </p>
          <Timeline shots={shots} />
        </div>
      )}

      {/* ── Characters ── */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: '#555' }}>Characters</p>
          <div className="flex-1 h-px" style={{ background: '#1a1a1a' }} />
        </div>
        <div className="space-y-4">
          {script.characters.map((char, i) => (
            <div key={i} className="rounded border p-4 space-y-3"
              style={{ borderColor: '#1a1a1a', background: '#0c0c0c' }}>
              <div className="flex items-center gap-4">
                {/* Role badge */}
                <span className="text-[10px] tracking-[0.2em] uppercase px-2 py-1 rounded"
                  style={{
                    background: char.role === 'protagonist' ? '#1a2a1a' : '#1a1a2a',
                    color: char.role === 'protagonist' ? '#5a7a5a' : '#5a5a7a',
                    border: `1px solid ${char.role === 'protagonist' ? '#2a3a2a' : '#2a2a3a'}`,
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
                  style={{ color: '#e0e0e0', flex: 1 }}
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
                style={{ color: '#666' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Shot list ── */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: '#555' }}>Shot List</p>
          <div className="flex-1 h-px" style={{ background: '#1a1a1a' }} />
          <p className="text-[10px]" style={{ color: '#2a2a2a' }}>{shots.length} shots</p>
        </div>
        <div className="space-y-3">
          {shots.map((shot, i) => (
            <ShotCard key={i} shot={shot} index={i} onChange={updated => updateShot(i, updated)} />
          ))}
        </div>
      </div>

      {/* ── Direction ── */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <p className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ color: '#555' }}>Direction</p>
          <div className="flex-1 h-px" style={{ background: '#1a1a1a' }} />
        </div>
        <div className="space-y-5">
          {[
            { label: 'Visual Style',  value: script.visual_style,  key: 'visual_style'  as const },
            { label: 'Narrative Arc', value: script.narrative_arc, key: 'narrative_arc' as const },
          ].map(({ label, value, key }) => (
            <div key={key}>
              <p className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: '#333' }}>{label}</p>
              <Editable
                value={value}
                onChange={v => update({ [key]: v })}
                multiline
                rows={3}
                className="text-sm font-light leading-relaxed"
                style={{ color: '#888' }}
              />
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
