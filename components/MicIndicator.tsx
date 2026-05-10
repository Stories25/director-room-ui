'use client'

interface MicIndicatorProps {
  isActive: boolean
  isMuted: boolean
}

export default function MicIndicator({ isActive, isMuted }: MicIndicatorProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex items-center justify-center">
        {/* Outer ring — only when active and unmuted */}
        {isActive && !isMuted && (
          <div
            className="absolute h-4 w-4 rounded-full mic-pulse"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          />
        )}
        {/* Core dot */}
        <div
          className="h-2 w-2 rounded-full transition-colors duration-300"
          style={{
            background: isMuted
              ? '#3a3a3a'
              : isActive
              ? '#f0f0f0'
              : '#3a3a3a',
          }}
        />
      </div>
      <span
        className="text-xs tracking-widest uppercase"
        style={{ color: isMuted ? '#3a3a3a' : '#5a5a5a' }}
      >
        {isMuted ? 'Muted' : isActive ? 'Listening' : 'Ready'}
      </span>
    </div>
  )
}
