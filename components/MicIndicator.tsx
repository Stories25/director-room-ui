'use client'

interface MicIndicatorProps {
  isActive: boolean
  isMuted: boolean
}

export default function MicIndicator({ isActive, isMuted }: MicIndicatorProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex items-center justify-center">
        {isActive && !isMuted && (
          <div
            className="absolute h-4 w-4 rounded-full mic-pulse"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          />
        )}
        <div
          className="h-2 w-2 rounded-full transition-colors duration-300"
          style={{
            background: isMuted
              ? 'var(--text-muted)'
              : isActive
              ? 'var(--text-primary)'
              : 'var(--text-muted)',
          }}
        />
      </div>
      <span
        className="text-xs tracking-widest uppercase"
        style={{ color: isMuted ? 'var(--text-muted)' : 'var(--text-tertiary)' }}
      >
        {isMuted ? 'Muted' : isActive ? 'Listening' : 'Ready'}
      </span>
    </div>
  )
}
