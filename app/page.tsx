'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Plus } from 'lucide-react'
import type { ProjectListItem } from '@/lib/argon'
import { Sprocket, TopBar, MAX_W } from '@/components/shell/Shell'
import Button from '@/components/ui/Button'

type ViewState = 'loading' | 'ready' | 'empty' | 'error'

function formatRelativeDate(iso: string): string {
  const then = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ProjectCard({ project, onClick }: { project: ProjectListItem; onClick: () => void }) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasImage = !!project.thumbnail_url
  const hasVideo = !!project.final_video_url

  useEffect(() => {
    if (isHovered && hasVideo) {
      videoRef.current?.play().catch(() => {})
    } else {
      videoRef.current?.pause()
    }
  }, [isHovered, hasVideo])

  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded overflow-hidden border transition-all duration-300 flex flex-col"
      style={{
        borderColor: 'var(--border-standard)',
        background: 'var(--surface-1)',
        borderRadius: 4,
      }}
      onMouseEnter={e => {
        setIsHovered(true)
        e.currentTarget.style.borderColor = 'var(--border-emphasis)'
        e.currentTarget.style.boxShadow = '0 4px 32px rgba(170,136,68,0.10)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        setIsHovered(false)
        e.currentTarget.style.borderColor = 'var(--border-standard)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Hero — contact sheet or first frame */}
      <div
        className="relative flex-none overflow-hidden"
        style={{ aspectRatio: '16/10', background: 'var(--surface-2)' }}
      >
        {hasImage ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 shimmer z-0" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.thumbnail_url!}
              alt={project.title}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
            />
            {/* Hover video preview (muted, loops) */}
            {hasVideo && (
              <video
                ref={videoRef}
                src={project.final_video_url!}
                muted
                loop
                playsInline
                preload="none"
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
              />
            )}
            {/* Hover overlay */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10"
              style={{ background: 'rgba(255,255,255,0.65)' }}
            >
              <span
                className="inline-flex items-center gap-2 px-6 py-2.5 text-[10px] tracking-[0.2em] uppercase border"
                style={{ borderColor: 'var(--border-emphasis)', color: 'var(--text-primary)', borderRadius: 2 }}
              >
                Open Storyboard <ArrowRight className="w-3 h-3 inline-block" />
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{ width: 3, height: 3, background: 'var(--border-subtle)' }}
                  />
                ))}
              </div>
              <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)' }}>
                No preview
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="flex-1 p-5 space-y-3">
        <div>
          <p className="text-base font-light leading-snug" style={{ color: 'var(--text-primary)' }}>
            {project.title}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Dates */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
              {formatRelativeDate(project.updated_at)}
            </span>
            {project.updated_at !== project.created_at && (
              <>
                <span style={{ color: 'var(--border-subtle)' }}>·</span>
                <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                  created {formatRelativeDate(project.created_at)}
                </span>
              </>
            )}
          </div>

          {/* Project ID snippet */}
          <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
            {project.id.slice(0, 8)}
          </span>
        </div>
      </div>
    </button>
  )
}

function NewSessionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="primary" size="md" onClick={onClick}>
      <Plus className="w-4 h-4" /> Build a new story
    </Button>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [viewState, setViewState] = useState<ViewState>('loading')
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isStartingSession, setIsStartingSession] = useState(false)

  useEffect(() => {
    document.title = "Projects | Director's Room"
  }, [])

  const handleBeginSession = useCallback(async () => {
    setIsStartingSession(true)
    // Clean up any stale prewarm data
    sessionStorage.removeItem('directors-room-prewarm')

    // Fire session creation in background — don't block navigation
    fetch('/api/avatar/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarId: process.env.NEXT_PUBLIC_AVATAR_ID }),
    })
      .then(async (res) => {
        if (res.ok) {
          const { sessionId } = await res.json()
          sessionStorage.setItem(
            'directors-room-prewarm',
            JSON.stringify({ sessionId, avatarId: process.env.NEXT_PUBLIC_AVATAR_ID })
          )
        }
      })
      .catch((err) => {
        console.warn('[home] Pre-warm failed, room will create fresh session:', err)
      })

    // Navigate immediately — provisioning happens in the background
    router.push('/room')
  }, [router])

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
        // Sort by updated_at descending (most recently worked on first)
        const sorted = (list as ProjectListItem[]).sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        setProjects(sorted)
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
        rightAction={<NewSessionButton onClick={handleBeginSession} />}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: MAX_W, margin: '0 auto', paddingTop: 40, paddingBottom: 80 }}>

          {/* Loading */}
          {viewState === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-6 py-32">
              <div className="h-8 w-8 rounded-full border-t animate-spin"
                style={{ borderColor: 'var(--surface-2)', borderTopColor: 'var(--text-secondary)' }} />
              <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>Loading projects...</p>
            </div>
          )}

          {/* Error */}
          {viewState === 'error' && (
            <div className="flex flex-col items-center justify-center gap-6 py-32">
              <p className="text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--text-tertiary)' }}>
                Something went wrong
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

          {/* Empty — landing CTA */}
          {viewState === 'empty' && (
            <div className="flex flex-col items-center justify-center gap-8 py-32 relative">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'radial-gradient(ellipse 60% 50% at 50% 60%, rgba(0,0,0,0.03) 0%, transparent 70%)',
                }}
              />
              <div className="relative z-10 flex flex-col items-center gap-8 text-center stagger-children">
                <p className="text-xs tracking-[0.3em] uppercase" style={{ color: 'var(--text-muted)' }}>
                  Director&apos;s Room
                </p>
                <div className="h-px w-12" style={{ background: 'var(--accent-amber)' }} />
                <h1
                  className="text-6xl font-display font-light leading-none"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Tell your story.
                </h1>
                <p className="text-base font-light" style={{ color: 'var(--text-tertiary)' }}>
                  Your story writer is waiting.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleBeginSession}
                  disabled={isStartingSession}
                  className="mt-4"
                >
                  {isStartingSession ? 'Calling Hank...' : 'Begin Session'}
                </Button>

                {/* Workflow preview */}
                <div className="mt-12 flex items-center gap-4">
                  {[
                    { label: 'Story', desc: 'Talk to the writer' },
                    { label: 'Script', desc: 'Edit the draft' },
                    { label: 'Storyboard', desc: 'Frame the shots' },
                    { label: 'Video', desc: 'Generate clips' },
                    { label: 'Sound', desc: 'Add music' },
                  ].map((step, i, arr) => (
                    <div key={step.label} className="flex items-center gap-4">
                      <div className="text-center space-y-1">
                        <div
                          className="w-8 h-8 rounded-full border flex items-center justify-center mx-auto"
                          style={{ borderColor: 'var(--border-standard)' }}
                        >
                          <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                            {i + 1}
                          </span>
                        </div>
                        <p className="text-[10px] tracking-[0.15em] uppercase font-slate" style={{ color: 'var(--text-tertiary)' }}>
                          {step.label}
                        </p>
                        <p className="text-[9px] font-slate" style={{ color: 'var(--text-muted)' }}>
                          {step.desc}
                        </p>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="w-4 h-px mt-[-16px]" style={{ background: 'var(--border-subtle)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Projects — card grid */}
          {viewState === 'ready' && projects.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-slate tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)' }}>
                  {projects.length} project{projects.length !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                  Sorted by last updated
                </p>
              </div>
              <div
                className="grid gap-6"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))' }}
              >
                {projects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => router.push(`/storyboard/${project.id}`)}
                  />
                ))}
              </div>
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
