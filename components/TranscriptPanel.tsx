'use client'

import { useEffect, useRef } from 'react'
import { TranscriptEntry } from '@/lib/types'

interface TranscriptPanelProps {
  entries: TranscriptEntry[]
  isLoading?: boolean
}

export default function TranscriptPanel({ entries, isLoading }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries])

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-none border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <p className="text-xs tracking-[0.2em] uppercase font-slate" style={{ color: 'var(--text-muted)' }}>
          Transcript
        </p>
        {entries.length > 0 && (
          <p className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
            {entries.length} {entries.length === 1 ? 'exchange' : 'exchanges'}
          </p>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* Loading skeleton */}
        {isLoading && entries.length === 0 && (
          <div className="space-y-5 mt-4">
            {[85, 60, 90, 50].map((w, i) => (
              <div key={i} className={`flex flex-col gap-1.5 ${i % 2 === 1 ? 'items-end' : 'items-start'}`}>
                <div className="h-2 rounded shimmer" style={{ width: 32, opacity: 0.4 }} />
                <div className="h-3 rounded shimmer" style={{ width: `${w}%`, opacity: 0.25 }} />
              </div>
            ))}
            <p className="text-[10px] text-center tracking-[0.15em] uppercase mt-6"
              style={{ color: 'var(--text-muted)' }}>
              Waiting for Hank...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && entries.length === 0 && (
          <p className="text-xs text-center mt-8 italic" style={{ color: 'var(--text-muted)' }}>
            The conversation will appear here
          </p>
        )}

        {/* Entries */}
        {entries.map((entry, i) => {
          const isHank = entry.speaker === 'HANK'
          return (
            <div
              key={i}
              className={`flex flex-col gap-1 fade-up ${isHank ? 'items-start' : 'items-end'}`}
            >
              {/* Speaker label */}
              <p
                className="text-[10px] tracking-[0.15em] uppercase font-slate px-1"
                style={{ color: isHank ? 'var(--accent-amber)' : 'var(--text-muted)' }}
              >
                {isHank ? 'Hank' : 'You'}
              </p>

              {/* Bubble */}
              <div
                className="max-w-[85%] rounded-2xl px-4 py-2.5"
                style={{
                  background: isHank ? 'var(--surface-2)' : 'var(--text-primary)',
                  color: isHank ? 'var(--text-primary)' : 'var(--canvas)',
                  borderRadius: isHank
                    ? '4px 18px 18px 18px'
                    : '18px 4px 18px 18px',
                }}
              >
                <p className="text-sm font-light leading-relaxed">
                  {entry.text}
                </p>
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
