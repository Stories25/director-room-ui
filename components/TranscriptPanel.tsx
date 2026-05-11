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
        <p className="text-[10px] font-slate mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {entries.length > 0 ? `${entries.length} exchanges` : 'Conversation will appear here...'}
        </p>
      </div>

      {/* Entries — script supervisor log style */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {entries.length === 0 && (
          <p className="text-xs italic mt-8 text-center" style={{ color: 'var(--text-muted)' }}>
            The conversation will appear here...
          </p>
        )}

        {entries.map((entry, i) => {
          const isHank = entry.speaker === 'HANK'
          const isLatest = i === entries.length - 1

          return (
            <div key={i} className={`space-y-2 ${isLatest ? 'fade-up' : ''}`}>
              <div className="flex items-center gap-2">
                <div
                  className="h-1.5 w-1.5 rounded-full flex-none"
                  style={{
                    background: isHank ? 'var(--accent-amber)' : 'var(--text-muted)',
                  }}
                />
                <p
                  className="text-[10px] tracking-[0.15em] uppercase font-slate font-medium"
                  style={{
                    color: isHank ? 'var(--accent-amber)' : 'var(--text-muted)',
                  }}
                >
                  {isHank ? 'Hank' : 'You'}
                  {isLatest && (
                    <span className="ml-2 text-[9px]" style={{ color: 'var(--accent-green)' }}>
                      NOW
                    </span>
                  )}
                </p>
              </div>
              <p
                className="text-sm font-light leading-relaxed pl-3.5"
                style={{
                  color: isHank ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                "{entry.text}"
              </p>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
