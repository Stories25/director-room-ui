'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { StoryboardResult, StoryboardShot } from '@/lib/types'

type PageState = 'loading' | 'ready' | 'regenerating' | 'error'

const MAX_W = 1080 // px — centered column width

function sortShotKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    const [aS, aF] = a.split('.').map(Number)
    const [bS, bF] = b.split('.').map(Number)
    return aS !== bS ? aS - bS : aF - bF
  })
}

function getActiveImageUrl(shot: StoryboardShot): string | null {
  const gens = shot.image?.generations
  if (!gens || gens.length === 0) return null
  const active = shot.image.active
  const gen = gens.find(g => g.version === active) ?? gens[gens.length - 1]
  return gen?.url ?? null
}

function ShotCard({ shotKey, shot }: { shotKey: string; shot: StoryboardShot }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const url = getActiveImageUrl(shot)
  const sd = shot.script_data

  return (
    <div
      className="rounded overflow-hidden border flex flex-col"
      style={{ borderColor: '#1a1a1a', background: '#0c0c0c' }}
    >
      {/* Image */}
      <div className="relative bg-[#111]" style={{ aspectRatio: '16/9' }}>
        {url ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 shimmer" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Shot ${shotKey}`}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="absolute inset-0 shimmer" />
        )}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-mono"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#555' }}>
          {shotKey}
        </div>
        {sd?.duration && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#555' }}>
            {sd.duration}
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-1.5 flex-1">
        {sd?.framing && (
          <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: '#3a3a3a' }}>
            {sd.framing}
          </p>
        )}
        {sd?.description && (
          <p className="text-xs font-light leading-relaxed" style={{ color: '#888' }}>
            {sd.description.length > 90 ? sd.description.slice(0, 90) + '...' : sd.description}
          </p>
        )}
        {sd?.dialogue && sd.dialogue.length > 0 && (
          <p className="text-xs italic" style={{ color: '#555' }}>
            &ldquo;{sd.dialogue[0]}&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}

export default function StoryboardPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('directors-room-storyboard')
    if (!stored) { router.push('/'); return }
    try {
      setStoryboard(JSON.parse(stored))
      setPageState('ready')
    } catch {
      router.push('/')
    }
  }, [router])

  const handleRegenerate = useCallback(async () => {
    const storedScript = sessionStorage.getItem('directors-room-script')
    if (!storedScript) return
    setPageState('regenerating')
    setError(null)
    try {
      const script = JSON.parse(storedScript)
      const res = await fetch('/api/submit-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Regeneration failed')
      }
      const { storyboard: next, projectId: nextId } = await res.json()
      sessionStorage.setItem('directors-room-storyboard', JSON.stringify(next))
      setStoryboard(next)
      setPageState('ready')
      // Update URL to new project ID
      router.replace(`/storyboard/${nextId}`)
    } catch (err) {
      setError(String(err))
      setPageState('error')
    }
  }, [router])

  if (pageState === 'loading' || !storyboard) return null

  const shotKeys = sortShotKeys(Object.keys(storyboard.shots))

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden bg-[#080808]">

      {/* ── Top bar ── */}
      <div className="flex-none w-full border-b" style={{ borderColor: '#1a1a1a' }}>
        <div
          className="flex items-center justify-between py-4"
          style={{ width: MAX_W, margin: '0 auto' }}
        >
          <div className="flex items-center gap-3">
            <p className="text-xs tracking-[0.25em] uppercase" style={{ color: '#444' }}>
              Director&apos;s Room
            </p>
            <span style={{ color: '#222' }}>·</span>
            <p className="text-xs tracking-[0.15em] uppercase" style={{ color: '#555' }}>
              Storyboard
            </p>
            <span style={{ color: '#222' }}>·</span>
            <p className="text-xs font-mono" style={{ color: '#333' }}>
              {projectId}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {pageState === 'error' && (
              <p className="text-xs" style={{ color: '#cc5555' }}>{error}</p>
            )}
            <button
              onClick={handleRegenerate}
              disabled={pageState === 'regenerating'}
              className="px-5 py-2 text-xs tracking-widest uppercase border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: '#2a2a2a', color: '#666', borderRadius: 4 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#bbb' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#666' }}
            >
              {pageState === 'regenerating' ? 'Regenerating...' : '↺ Regenerate'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Regenerating overlay ── */}
      {pageState === 'regenerating' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[#080808]">
          <div className="h-8 w-8 rounded-full border-t animate-spin"
            style={{ borderColor: '#1e1e1e', borderTopColor: '#666' }} />
          <p className="text-sm font-light" style={{ color: '#888' }}>Generating new storyboard...</p>
          <p className="text-xs" style={{ color: '#333' }}>This takes 60–90 seconds</p>
        </div>
      )}

      {/* ── Grid ── */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: MAX_W, margin: '0 auto', paddingTop: 32, paddingBottom: 32 }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {shotKeys.map(key => (
              <ShotCard key={key} shotKey={key} shot={storyboard.shots[key]} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex-none w-full border-t" style={{ borderColor: '#1a1a1a', background: '#0a0a0a' }}>
        <div
          className="flex items-center justify-between py-4"
          style={{ width: MAX_W, margin: '0 auto' }}
        >
          <p className="text-xs" style={{ color: '#2a2a2a' }}>Video generation coming next.</p>
          <p className="text-xs" style={{ color: '#2a2a2a' }}>Powered by Runway</p>
        </div>
      </div>
    </main>
  )
}
