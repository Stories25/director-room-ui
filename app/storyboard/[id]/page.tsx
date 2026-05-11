'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { Check, Loader2, ArrowUp, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react'
import { StoryboardResult, StoryboardShot } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import { generateScript, generateStoryboard, buildPrompt, createProject, upscaleStoryboard } from '@/lib/argon-browser'
import { pipelineState, PipelineStep } from '@/lib/pipeline-state'
import StoryboardWaiting from '@/components/StoryboardWaiting'
import { isUpscaledAll } from '@/lib/types'
import Button from '@/components/ui/Button'
import WorkflowStepper from '@/components/WorkflowStepper'

type PageState = 'loading' | 'building' | 'ready' | 'error'
type UpscaleState = 'idle' | 'upscaling' | 'done' | 'error'

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
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(170,136,68,0.12)'
        e.currentTarget.style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-standard)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Image */}
      <div className="relative" style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}>
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ boxShadow: 'inset 0 0 40px rgba(0,0,0,0.4)' }}
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
        <div className="absolute top-3 left-3 z-20 px-1.5 py-0.5 rounded text-[10px] font-slate border"
          style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--accent-amber)', borderColor: 'rgba(170,136,68,0.3)' }}>
          {shotKey}
        </div>
        {sd?.duration && (
          <div className="absolute top-3 right-3 z-20 px-1.5 py-0.5 rounded text-[10px] font-slate"
            style={{ background: 'rgba(0,0,0,0.75)', color: 'var(--accent-amber)' }}>
            {sd.duration}
          </div>
        )}
      </div>

      {/* Metadata */}
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
  const searchParams = useSearchParams()
  const projectId = params?.id as string

  // Always start with 'loading' — resolved after mount so server and client
  // render the same initial HTML (avoids hydration mismatch from sessionStorage
  // and useSearchParams which are unavailable on the server).
  const [pageState, setPageState] = useState<PageState>('loading')
  const [storyboard, setStoryboard] = useState<StoryboardResult | null>(null)
  const [currentStep, setCurrentStep] = useState<PipelineStep>('script')
  const [error, setError] = useState<string | null>(null)
  const [upscaleState, setUpscaleState] = useState<UpscaleState>('idle')

  useEffect(() => {
    if (storyboard?.projectTitle) {
      document.title = `${storyboard.projectTitle} | Storyboard`
    } else {
      document.title = "Storyboard | Director's Room"
    }
  }, [storyboard?.projectTitle])

  // Pipeline ref — populated on mount from sessionStorage
  const pipelineRef = useRef(pipelineState.read())

  // Resolve the real initial state once on the client after mount
  useEffect(() => {
    const isBuilding = searchParams?.get('building') === '1'
    const pipeline = pipelineRef.current
    const cachedStoryboard = readSessionStoryboard()

    if (cachedStoryboard && cachedStoryboard.projectId === projectId) {
      setStoryboard(cachedStoryboard)
      setUpscaleState(isUpscaledAll(cachedStoryboard.shots) ? 'done' : 'idle')
      setPageState('ready')
      return
    }

    if (isBuilding && pipeline?.projectId === projectId) {
      setCurrentStep(pipeline.step === 'storyboard' ? 'storyboard' : 'script')
      setPageState('building')
      return
    }

    // Soft-refresh lost ?building=1 but pipeline state is still in sessionStorage
    if (pipeline?.projectId === projectId) {
      setCurrentStep(pipeline.step === 'storyboard' ? 'storyboard' : 'script')
      setPageState('building')
      return
    }

    // Cold load — no local context at all
    setPageState('loading')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally runs once on mount only

  // Sync upscale state when storyboard arrives from the cold-load API path
  useEffect(() => {
    if (storyboard && upscaleState === 'idle') {
      if (isUpscaledAll(storyboard.shots)) setUpscaleState('done')
    }
  }, [storyboard, upscaleState])

  // Guard: ensure runPipeline only fires once even in React StrictMode
  const pipelineStarted = useRef(false)

  // ── Building: run steps 2 → 3 sequentially ────────────────────────────────
  const runPipeline = useCallback(async (pid: string) => {
    const pl = pipelineRef.current
    try {
      // Step 2 — generate script
      setCurrentStep('script')
      if (pl) pipelineState.write({ ...pl, projectId: pid, step: 'script' })
      await generateScript(pid)

      // Step 3 — generate storyboard
      setCurrentStep('storyboard')
      if (pl) pipelineState.write({ ...pl, projectId: pid, step: 'storyboard' })
      const sb = await generateStoryboard(pid)
      sb.projectTitle = pl?.script?.title

      // Done
      pipelineState.clear()
      sessionStorage.setItem('directors-room-storyboard', JSON.stringify(sb))
      setStoryboard(sb)
      setPageState('ready')
      router.replace(`/storyboard/${pid}`)
    } catch (err) {
      console.error('[storyboard] Pipeline failed:', err)
      setError(String(err))
      setPageState('error')
    }
  }, [router])

  useEffect(() => {
    if (pageState === 'building') {
      if (pipelineStarted.current) return
      pipelineStarted.current = true
      const pl = pipelineRef.current
      // Resume from storyboard step if script was already done
      if (pl?.step === 'storyboard') {
        setCurrentStep('storyboard')
        if (pl) pipelineState.write({ ...pl, step: 'storyboard' })
        generateStoryboard(projectId)
          .then(sb => {
            sb.projectTitle = pl?.script?.title
            pipelineState.clear()
            sessionStorage.setItem('directors-room-storyboard', JSON.stringify(sb))
            setStoryboard(sb)
            setPageState('ready')
            router.replace(`/storyboard/${projectId}`)
          })
          .catch(err => {
            console.error('[storyboard] Step 3 failed:', err)
            setError(String(err))
            setPageState('error')
          })
      } else {
        runPipeline(projectId)
      }
      return
    }

    if (pageState === 'loading') {
      // Cold load — no local context, fetch from API
      let cancelled = false
      async function fetchFromAPI() {
        try {
          const res = await fetch(`/api/projects/${projectId}`)
          if (!res.ok) throw new Error('Project not found')
          const { project } = await res.json()
          if (cancelled) return
          if (!project?.storyboard?.shots || Object.keys(project.storyboard.shots).length === 0) {
            router.push('/')
            return
          }
          const sb: StoryboardResult = {
            projectId: project.id,
            projectTitle: project.title,
            shots: project.storyboard.shots,
            activeGrid: project.storyboard.active_grid,
          }
          setStoryboard(sb)
          setPageState('ready')
        } catch (err) {
          if (cancelled) return
          console.error('[storyboard] Fetch failed:', err)
          router.push('/')
        }
      }
      fetchFromAPI()
      return () => { cancelled = true }
    }
  }, [pageState, projectId, router, runPipeline])

  // ── Regenerate ─────────────────────────────────────────────────────────────
  const handleRegenerate = useCallback(async () => {
    const storedScript = sessionStorage.getItem('directors-room-script')
    if (!storedScript) return
    try {
      const script = JSON.parse(storedScript)
      const prompt = buildPrompt(script)
      const newProjectId = await createProject(script.title || "Director's Room Teaser", prompt)
      pipelineState.write({ projectId: newProjectId, script, step: 'script', startedAt: Date.now() })
      // Navigate to the new project — the building flow will kick in on mount
      router.push(`/storyboard/${newProjectId}?building=1`)
    } catch (err) {
      console.error('[storyboard] Regenerate failed at step 1:', err)
      setError(String(err))
      setPageState('error')
    }
  }, [router])

  const handleStartOver = useCallback(() => {
    pipelineState.clear()
    router.push('/')
  }, [router])

  // ── Upscale ────────────────────────────────────────────────────────────────
  const handleUpscale = useCallback(async () => {
    if (!storyboard) return
    setUpscaleState('upscaling')
    try {
      const upscaled = await upscaleStoryboard(projectId)
      upscaled.projectTitle = storyboard.projectTitle
      sessionStorage.setItem('directors-room-storyboard', JSON.stringify(upscaled))
      setStoryboard(upscaled)
      setUpscaleState('done')
    } catch (err) {
      console.error('[storyboard] Upscale failed:', err)
      setUpscaleState('error')
    }
  }, [storyboard, projectId])

  // ── Building / error view ──────────────────────────────────────────────────
  if (pageState === 'building' || pageState === 'error') {
    const script = pipelineRef.current?.script
    if (!script) {
      // Pipeline state lost entirely — go home
      router.push('/')
      return null
    }
    return (
      <StoryboardWaiting
        script={script}
        projectId={projectId}
        currentStep={currentStep}
        error={pageState === 'error' ? error : null}
        onStartOver={handleStartOver}
      />
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (pageState === 'loading' || !storyboard) return null

  // ── Ready ──────────────────────────────────────────────────────────────────
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
          <div className="flex items-center gap-2">
            {/* Upscale button */}
            <Button
              variant={upscaleState === 'done' ? 'success' : upscaleState === 'error' ? 'error' : 'secondary'}
              size="sm"
              onClick={handleUpscale}
              disabled={upscaleState === 'upscaling' || upscaleState === 'done'}
              title={upscaleState === 'done' ? 'All frames are already upscaled to 2K' : 'Upscale all frames to 2K'}
              style={{ opacity: upscaleState === 'upscaling' ? 0.6 : 1 }}
            >
              {upscaleState === 'upscaling' && <Loader2 className="w-3 h-3 animate-spin" />}
              {upscaleState === 'done'      && <><Check className="w-3 h-3" /> Upscaled 2K</>}
              {upscaleState === 'upscaling' && <>Upscaling</>}
              {upscaleState === 'idle'      && <><ArrowUp className="w-3 h-3" /> Upscale 2K</>}
              {upscaleState === 'error'     && <><ArrowUp className="w-3 h-3" /> Retry Upscale</>}
            </Button>

            {/* Regenerate button */}
            <Button variant="secondary" size="sm" onClick={handleRegenerate}>
              <RefreshCw className="w-3 h-3" /> Regenerate
            </Button>
          </div>
        }
      />

      <WorkflowStepper current="storyboard" projectId={projectId} />

      {/* Grid */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: MAX_W, margin: '0 auto', paddingTop: 32, paddingBottom: 32 }}>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {shotKeys.flatMap((key, i) => {
              const scene = Number(key.split('.')[0])
              const prevScene = i > 0 ? Number(shotKeys[i - 1].split('.')[0]) : 0
              if (scene !== prevScene) {
                return [
                  <div key={`scene-${scene}`} className="col-span-3 flex items-center gap-4 pt-4">
                    <span className="text-[10px] tracking-[0.3em] uppercase font-slate" style={{ color: 'var(--accent-amber)' }}>
                      Scene {scene}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                  </div>,
                  <ShotCard key={key} shotKey={key} shot={storyboard.shots[key]} />,
                ]
              }
              return [<ShotCard key={key} shotKey={key} shot={storyboard.shots[key]} />]
            })}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between py-4" style={{ width: MAX_W, margin: '0 auto' }}>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
              <ArrowLeft className="w-3 h-3" /> Projects
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push('/script')}>
              View Script
            </Button>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(`/video/${projectId}`)}
            className="group gap-2"
          >
            Generate Video <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </main>
  )
}
