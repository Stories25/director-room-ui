'use client'

interface WaveformIndicatorProps {
  isActive: boolean
  isMuted: boolean
  isSpeaking: boolean
}

const DURATIONS = [0.55, 0.42, 0.68, 0.50, 0.73, 0.45, 0.60, 0.38, 0.65, 0.52]
const DELAYS =    [0.00, 0.08, 0.04, 0.12, 0.02, 0.09, 0.05, 0.14, 0.01, 0.07]

export default function WaveformIndicator({ isActive, isMuted, isSpeaking }: WaveformIndicatorProps) {
  const animated = isActive && !isMuted && isSpeaking

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-[3px]" style={{ height: 22 }}>
        {DURATIONS.map((dur, i) => (
          <div
            key={i}
            className="w-[3px] rounded-full"
            style={{
              height: animated ? undefined : '20%',
              background: isMuted
                ? 'var(--text-muted)'
                : animated
                ? 'var(--text-secondary)'
                : isActive
                ? 'var(--text-tertiary)'
                : 'var(--text-muted)',
              animationName: animated ? 'wave' : 'none',
              animationDuration: `${dur}s`,
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
              animationDirection: 'alternate',
              animationDelay: `${DELAYS[i]}s`,
              alignSelf: 'center',
              minHeight: '15%',
              maxHeight: '100%',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      <p
        className="text-xs tracking-widest uppercase"
        style={{
          color: isMuted ? 'var(--text-muted)' : animated ? 'var(--text-tertiary)' : isActive ? 'var(--text-tertiary)' : 'var(--text-muted)',
          minWidth: 64,
          transition: 'color 0.3s',
        }}
      >
        {isMuted ? 'Muted' : isSpeaking ? 'Speaking' : isActive ? 'Listening' : 'Ready'}
      </p>
    </div>
  )
}
