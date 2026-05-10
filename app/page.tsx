'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectListItem, ProjectDetail } from '@/lib/argon'
import { Sprocket, TopBar } from '@/components/shell/Shell'

type ViewState = 'loading' | 'ready' | 'empty' | 'error'

const MAX_W = 1080

function formatRelativeDate(iso: string): string {
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getGridImageUrl(project: ProjectDetail): string | null {
  if (!project.storyboard?.grids) return null
  const keys = Object.keys(project.storyboard.grids)
  if (keys.length === 0) return null
  const sorted = keys.sort((a, b) => Number(b) - Number(a))
  return project.storyboard.grids[sorted[0]]?.url ?? null
}

function getFirstShotUrl(project: ProjectDetail): string | null {
  if (!project.storyboard?.shots) return null
  const keys = Object.keys(project.storyboard.shots).sort()
  if (keys.length === 0) return null
  const shot = project.storyboard.shots[keys[0]]
  const gens = shot?.image?.generations
  if (!gens || gens.length === 0) return null
  return gens[gens.length - 1]?.url ?? null
}

function getShotCount(project: ProjectDetail): number {
  return project.storyboard?.shots ? Object.keys(project.storyboard.shots).length : 0
}

function getTotalDuration(project: ProjectDetail): string {
  if (!project.storyboard?.shots) return '0s'
  const shots = Object.values(project.storyboard.shots)
  let total = 0
  for (const s of shots) {
    const d = s.script_data?.duration
    if (d) {
      const n = parseInt(d, 10)
      if (!isNaN(n)) total += n
    }
  }
  return `${total}s`
}

function FilmStripRow({ project, onClick }: { project: ProjectListItem; onClick: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [detail, setDetail] = useState<ProjectDetail | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadDetail() {
      try {
        const res = await fetch(`/api/projects/${project.id}`)
        if (!res.ok) return
        const { project: p } = await res.json()
        if (!cancelled) setDetail(p)
      } catch {
        // silently fail
      }
    }
    loadDetail()
    return () => { cancelled = true }
  }, [project.id])

  const gridUrl = detail ? getGridImageUrl(detail) : null
  const fallbackUrl = !gridUrl && detail ? getFirstShotUrl(detail) : null
  const imgSrc = gridUrl || fallbackUrl
  const shotCount = detail ? getShotCount(detail) : 0
  const totalDur = detail ? getTotalDuration(detail) : null

  return (
    <button
      onClick={onClick}
      className="group text-left w-full flex items-stretch gap-0 border transition-all duration-300 overflow-hidden"
      style={{
        borderColor: 'var(--border-standard)',
        background: 'var(--surface-1)',
        borderRadius: 3,
      }}
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
      {/* Thumbnail — like a film frame */}
      <div
        className="relative flex-none overflow-hidden"
        style={{ width: 240, aspectRatio: '16/10', background: 'var(--surface-2)' }}
      >
        {imgSrc ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 shimmer" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={project.title}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
            {/* Hover overlay */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
              style={{ background: 'rgba(8,8,8,0.55)' }}
            >
              <span
                className="px-5 py-2 text-[10px] tracking-[0.2em] uppercase border"
                style={{ borderColor: 'var(--border-emphasis)', color: 'var(--text-primary)', borderRadius: 2 }}
              >
                Open
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 shimmer" />
        )}
      </div>

      {/* Metadata — like a slate */}
      <div className="flex-1 flex flex-col justify-between p-5">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-light leading-snug" style={{ color: 'var(--text-primary)' }}>
              {project.title}
            </p>
            <p className="text-[10px] font-slate flex-none pt-0.5" style={{ color: 'var(--text-muted)' }}>
              {formatRelativeDate(project.created_at)}
            </p>
          </div>
          {shotCount > 0 && totalDur && (
            <p className="text-[10px] font-slate tracking-[0.15em] uppercase" style={{ color: 'var(--text-tertiary)' }}>
              {shotCount} frames · {totalDur}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Sprocket holes decorative */}
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 3,
                  height: 3,
                  background: 'var(--border-subtle)',
                }}
              />
            ))}
          </div>
          <p className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
            {project.id.slice(0, 8)}
          </p>
        </div>
      </div>
    </button>
  )
}

function NewSessionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-6 py-2 text-xs tracking-[0.2em] uppercase border transition-all duration-200"
      style={{
        borderColor: 'var(--border-standard)',
        color: 'var(--text-secondary)',
        background: 'var(--surface-1)',
        borderRadius: 2,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--border-emphasis)'
        e.currentTarget.style.color = 'var(--text-primary)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-standard)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
    >
      New Session
    </button>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/projects')
        if (!res.ok) throw new Error('Failed to load projects')
        const { projects: list } = await res.json()
        if (cancelled) return
        if (!list || list.length === 0) {
          setViewState('empty')
          return
        }
        setProjects(list)
        setViewState('ready')
      } catch (err) {
        if (cancelled) return
        console.error('[home] Load failed:', err)
        setError(String(err))
        setViewState('error')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[{ label: 'Projects', current: true }]}
        rightAction={<NewSessionButton onClick={() => router.push('/room')} />}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: MAX_W, margin: '0 auto', paddingTop: 32, paddingBottom: 80 }}>

          {/* Loading */}
          {viewState === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-6 py-32">
              <div className="h-8 w-8 rounded-full border-t animate-spin"
                style={{ borderColor: 'var(--surface-2)', borderTopColor: 'var(--text-secondary)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading projects...</p>
            </div>
          )}

          {/* Error */}
          {viewState === 'error' && (
            <div className="flex flex-col items-center justify-center gap-6 py-32">
              <p className="text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Something went wrong
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 text-xs tracking-[0.2em] uppercase border transition-all duration-200"
                style={{ borderColor: 'var(--border-standard)', color: 'var(--text-tertiary)', borderRadius: 2 }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-emphasis)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-standard)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty — landing CTA */}
          {viewState === 'empty' && (
            <div className="flex flex-col items-center justify-center gap-8 py-32 relative">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(255,255,255,0.03) 0%, transparent 70%)',
                }}
              />
              <div className="relative z-10 flex flex-col items-center gap-8 text-center">
                <p className="text-xs tracking-[0.3em] uppercase" style={{ color: 'var(--text-muted)' }}>
                  Director&apos;s Room
                </p>
                <h1
                  className="text-6xl font-light leading-none tracking-tight"
                  style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
                >
                  Tell your story.
                </h1>
                <p className="text-base font-light" style={{ color: 'var(--text-tertiary)' }}>
                  Your story writer is waiting.
                </p>
                <button
                  onClick={() => router.push('/room')}
                  className="mt-4 cursor-pointer border px-10 py-3 text-sm font-light tracking-[0.2em] uppercase transition-all duration-300"
                  style={{ borderColor: 'var(--border-standard)', color: 'var(--text-secondary)', background: 'transparent', borderRadius: 2 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-emphasis)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-standard)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                  Begin Session
                </button>
              </div>
            </div>
          )}

          {/* Projects — film strip list */}
          {viewState === 'ready' && projects.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-slate tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)' }}>
                  {projects.length} project{projects.length !== 1 ? 's' : ''}
                </p>
              </div>
              {projects.map(project => (
                <FilmStripRow
                  key={project.id}
                  project={project}
                  onClick={() => router.push(`/storyboard/${project.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="flex-none w-full border-t"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}
      >
        <div className="flex items-center justify-between py-4" style={{ width: MAX_W, margin: '0 auto' }}>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Powered by Runway</p>
        </div>
      </div>
    </main>
  )
}
