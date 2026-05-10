'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { StoryboardResult, StoryboardShot } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'

type PageState = 'loading' | 'ready' | 'regenerating' | 'error'

const MAX_W = 1080

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
      className="rounded overflow-hidden border flex flex-col transition-all duration-300"
      style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-emphasis)'
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(170,136,68,0.08)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-standard)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Image — with inner vignette for light-table well effect */}
      <div className="relative" style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}>
        {/* Inner vignette overlay */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 40px rgba(0,0,0,0.4)',
          }}
        />
        {url ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 shimmer z-0" />}
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
        {/* Film frame number badge */}
        <div className="absolute top-3 left-3 z-20 px-1.5 py-0.5 rounded text-[10px] font-slate"
          style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--text-tertiary)' }}>
          {shotKey}
        </div>
        {/* Timecode badge */}
        {sd?.duration && (
          <div className="absolute top-3 right-3 z-20 px-1.5 py-0.5 rounded text-[10px] font-slate"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--accent-amber)' }}>
            {sd.duration}
          </div>
        )}
      </div>

      {/* Metadata — camera report style */}
      <div className="p-4 space-y-2 flex-1">
        {sd?.framing && (
          <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)' }}>
            {sd.framing}
          </p>
        )}
        {sd?.description && (
          <p className="text-sm font-light leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {sd.description.length > 90 ? sd.description.slice(0, 90) + '...' : sd.description}
          </p>
        )}
        {sd?.dialogue && sd.dialogue.length > 0 && (
          <p className="text-xs italic pl-3 border-l" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}>
            &ldquo;{sd.dialogue[0]}&rdquo;
          </p>
        )}
      </div>
    </div>
  )
}

function readSessionStoryboard(): StoryboardResult | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-storyboard')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

export default function StoryboardPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const sessionData = useMemo(() => readSessionStoryboard(), [])

  const [pageState, setPageState] = useState<PageState>(() =>
    sessionData ? 'ready' : 'loading'
  )
  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(sessionData)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionData) return

    let cancelled = false

    async function fetchFromAPI() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const { project } = await res.json()
        if (!project?.storyboard?.shots) {
          router.push('/')
          return
        }
        if (cancelled) return
        const sb: StoryboardResult = {
          projectId: project.id,
          shots: project.storyboard.shots,
          activeGrid: project.storyboard.active_grid,
        }
        setStoryboard(sb)
        setPageState('ready')
      } catch (err) {
        if (cancelled) return
        console.error('[storyboard] API fetch failed:', err)
        setError(String(err))
        setPageState('error')
      }
    }
    fetchFromAPI()

    return () => { cancelled = true }
  }, [router, projectId, sessionData])

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
      router.replace(`/storyboard/${nextId}`)
    } catch (err) {
      setError(String(err))
      setPageState('error')
    }
  }, [router])

  if (pageState === 'loading' || !storyboard) return null

  const shotKeys = sortShotKeys(Object.keys(storyboard.shots))

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Storyboard', current: true },
        ]}
        rightAction={
          <button
            onClick={handleRegenerate}
            disabled={pageState === 'regenerating'}
            className="px-5 py-2 text-xs tracking-[0.2em] uppercase border transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--border-standard)', color: 'var(--text-tertiary)', borderRadius: 2 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-emphasis)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-standard)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            {pageState === 'regenerating' ? 'Regenerating...' : '↺ Regenerate'}
          </button>
        }
      />

      {/* ── Regenerating overlay ── */}
      {(pageState === 'regenerating' || pageState === 'error') && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4" style={{ background: 'var(--canvas)' }}>
          <div className="h-8 w-8 rounded-full border-t animate-spin"
            style={{ borderColor: 'var(--surface-2)', borderTopColor: 'var(--text-secondary)' }} />
          <p className="text-sm font-light" style={{ color: 'var(--text-secondary)' }}>
            {pageState === 'error' ? 'Something went wrong' : 'Generating new storyboard...'}
          </p>
          {error && (
            <p className="text-xs font-slate max-w-sm text-center" style={{ color: 'var(--accent-red)' }}>{error}</p>
          )}
          <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
            {pageState === 'error' ? '' : 'This takes 60–90 seconds'}
          </p>
        </div>
      )}

      {/* ── Grid — light table ── */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: MAX_W, margin: '0 auto', paddingTop: 32, paddingBottom: 32 }}>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {shotKeys.map(key => (
              <ShotCard key={key} shotKey={key} shot={storyboard.shots[key]} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between py-4" style={{ width: MAX_W, margin: '0 auto' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-xs tracking-[0.2em] uppercase border px-4 py-2 transition-all duration-200"
              style={{ borderColor: 'var(--border-standard)', color: 'var(--text-tertiary)', borderRadius: 2 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-emphasis)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-standard)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              ← Projects
            </button>
            <button
              onClick={() => router.push('/script')}
              className="text-xs tracking-[0.2em] uppercase border px-4 py-2 transition-all duration-200"
              style={{ borderColor: 'var(--border-standard)', color: 'var(--text-tertiary)', borderRadius: 2 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-emphasis)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-standard)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
            >
              View Script
            </button>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Powered by Runway</p>
        </div>
      </div>
    </main>
  )
}
