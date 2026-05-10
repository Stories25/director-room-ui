'use client'

import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()

  return (
    <main className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#080808]">
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(255,255,255,0.03) 0%, transparent 70%)',
        }}
      />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center gap-8 text-center">
        {/* Label */}
        <p
          className="text-xs tracking-[0.3em] uppercase"
          style={{ color: '#3a3a3a' }}
        >
          Director&apos;s Room
        </p>

        {/* Headline */}
        <h1
          className="text-6xl font-light leading-none tracking-tight"
          style={{ color: '#f0f0f0', letterSpacing: '-0.02em' }}
        >
          Tell your story.
        </h1>

        {/* Subline */}
        <p className="text-base font-light" style={{ color: '#4a4a4a' }}>
          Your story writer is waiting.
        </p>

        {/* CTA */}
        <button
          onClick={() => router.push('/room')}
          className="mt-4 cursor-pointer border px-10 py-3 text-sm font-light tracking-widest uppercase transition-all duration-300"
          style={{
            borderColor: '#2a2a2a',
            color: '#a0a0a0',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#4a4a4a'
            e.currentTarget.style.color = '#f0f0f0'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#2a2a2a'
            e.currentTarget.style.color = '#a0a0a0'
          }}
        >
          Begin Session
        </button>
      </div>

      {/* Runway attribution — required by Runway branding policy */}
      <div
        className="absolute bottom-6 right-8 text-xs"
        style={{ color: '#2a2a2a' }}
      >
        Powered by Runway
      </div>
    </main>
  )
}
