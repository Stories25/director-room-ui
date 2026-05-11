'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import ScriptDocumentView from '@/components/ScriptDocument'
import { ScriptDocument } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import { buildPrompt, createProject } from '@/lib/argon-browser'
import { pipelineState } from '@/lib/pipeline-state'
import Button from '@/components/ui/Button'
import WorkflowStepper from '@/components/WorkflowStepper'

type PageState = 'loading' | 'review' | 'creating' | 'error'

function readSessionScript(): ScriptDocument | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-script')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

export default function ScriptPage() {
  const router = useRouter()
  const sessionData = useMemo(() => readSessionScript(), [])
  const [script, setScript] = useState<ScriptDocument | null>(sessionData)
  const [pageState, setPageState] = useState<PageState>(sessionData ? 'review' : 'loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (script?.title) {
      document.title = `${script.title} | Script`
    } else {
      document.title = "Script | Director's Room"
    }
  }, [script?.title])

  useEffect(() => {
    if (sessionData) return
    router.push('/')
  }, [router, sessionData])

  const handleSend = async () => {
    if (!script) return
    setError(null)
    setPageState('creating')
    try {
      const prompt = buildPrompt(script)
      const projectId = await createProject(script.title || "Director's Room Teaser", prompt)
      pipelineState.write({ projectId, script, step: 'script', startedAt: Date.now() })
      router.push(`/storyboard/${projectId}?building=1`)
    } catch (err) {
      console.error('[script] Step 1 failed:', err)
      setError(String(err))
      setPageState('error')
    }
  }

  if (!script) return null

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Script', current: true },
        ]}
      />

      <WorkflowStepper current="script" />

      {/* Scrollable document */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: 720, margin: '0 auto', padding: '40px 0 120px 0' }}>

          {pageState === 'error' && (
            <div className="mb-8 rounded border px-4 py-3 space-y-2"
              style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
              <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
              <Button variant="tertiary" size="sm" onClick={handleSend}>
                Retry <ArrowRight className="w-3 h-3 inline-block" />
              </Button>
            </div>
          )}

          <div className="fade-up">
            <ScriptDocumentView script={script} onChange={setScript} />
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between py-5" style={{ width: 720, margin: '0 auto' }}>
          <Button variant="secondary" size="sm" onClick={() => router.push('/room')}>
            <ArrowLeft className="w-3 h-3" /> Story
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSend}
            disabled={pageState === 'creating'}
            className="group gap-3"
          >
            {pageState === 'creating' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Creating project
              </>
            ) : (
              <span className="flex items-center gap-2">
                Build Storyboard <ArrowRight className="w-3 h-3 inline-block transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            )}
          </Button>
        </div>
      </div>
    </main>
  )
}
