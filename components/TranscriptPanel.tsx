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
      {/* Header */}
      <div
        className="flex-none border-b px-6 py-4"
        style={{ borderColor: '#1a1a1a' }}
      >
        <p className="text-xs tracking-[0.2em] uppercase" style={{ color: '#2e2e2e' }}>
          Transcript
        </p>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {entries.length === 0 && (
          <p className="text-xs italic mt-8 text-center" style={{ color: '#2a2a2a' }}>
            The conversation will appear here...
          </p>
        )}

        {entries.map((entry, i) => (
          <div key={i} className="fade-up space-y-1">
            <p
              className="text-xs tracking-[0.15em] uppercase"
              style={{
                color: entry.speaker === 'HANK' ? '#4a4a4a' : '#2e2e2e',
              }}
            >
              {entry.speaker === 'HANK' ? 'Hank' : 'You'}
            </p>
            <p
              className="text-sm font-light leading-relaxed"
              style={{
                color: entry.speaker === 'HANK' ? '#c0c0c0' : '#707070',
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
