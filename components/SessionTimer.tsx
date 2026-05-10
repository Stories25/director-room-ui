'use client'

import { useEffect, useState } from 'react'

interface SessionTimerProps {
  startedAt: number
  maxSeconds?: number
  onWarning?: () => void
  onCritical?: () => void
}

export default function SessionTimer({
  startedAt,
  maxSeconds = 300,
  onWarning,
  onCritical,
}: SessionTimerProps) {
  const [remaining, setRemaining] = useState(maxSeconds)
  const [warnedAt60, setWarnedAt60] = useState(false)
  const [warnedAt30, setWarnedAt30] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      const rem = Math.max(0, maxSeconds - elapsed)
      setRemaining(rem)

      if (rem <= 60 && !warnedAt60) {
        setWarnedAt60(true)
        onWarning?.()
      }
      if (rem <= 30 && !warnedAt30) {
        setWarnedAt30(true)
        onCritical?.()
      }
    }, 500)
    return () => clearInterval(interval)
  }, [startedAt, maxSeconds, onWarning, onCritical, warnedAt60, warnedAt30])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  const display = `${mins}:${String(secs).padStart(2, '0')}`

  const isCritical = remaining <= 30
  const isWarning  = remaining <= 60 && !isCritical

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: isCritical ? 'var(--accent-red)' : isWarning ? 'var(--accent-warm)' : 'var(--text-muted)',
          transition: 'background 0.5s',
        }}
      />
      <p
        className={`text-xs tabular-nums font-slate ${isCritical ? 'timer-flash' : ''}`}
        style={{
          color: isCritical ? 'var(--accent-red)' : isWarning ? 'var(--accent-warm)' : 'var(--text-muted)',
          transition: 'color 0.5s',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {display}
      </p>
    </div>
  )
}
