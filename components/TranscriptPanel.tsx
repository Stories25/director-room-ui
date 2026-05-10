'use client'

import { useEffect, useRef } from 'react'
import { TranscriptEntry } from '@/lib/types'

interface TranscriptPanelProps {
  entries: TranscriptEntry[]
}

export default function TranscriptPanel({ entries }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className="flex h-full flex-col">
      {/* Header — like a script supervisor's log header */}
      <div
        className="flex-none border-b px-6 py-4"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <p className="text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)' }}>
          Transcript
        </p>
      </div>

      {/* Entries — script supervisor log style */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {entries.length === 0 && (
          <p className="text-xs italic mt-8 text-center" style={{ color: 'var(--text-muted)' }}>
            The conversation will appear here...
          </p>
        )}

        {entries.map((entry, i) => (
          <div key={i} className="fade-up space-y-1.5">
            <p
              className="text-[10px] tracking-[0.15em] uppercase font-slate"
              style={{
                color: entry.speaker === 'HANK' ? 'var(--accent-amber)' : 'var(--text-muted)',
              }}
            >
              {entry.speaker === 'HANK' ? 'Hank' : 'You'}
            </p>
            <p
              className="text-sm font-light leading-relaxed"
              style={{
                color: entry.speaker === 'HANK' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {entry.text}
            </p>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
