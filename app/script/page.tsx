'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ScriptDocumentView from '@/components/ScriptDocument'
import { ScriptDocument } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import { buildPrompt, createProject } from '@/lib/argon-browser'
import { pipelineState } from '@/lib/pipeline-state'

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

      {/* Scrollable document */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: 720, margin: '0 auto', padding: '40px 0 120px 0' }}>

          {pageState === 'error' && (
            <div className="mb-8 rounded border px-4 py-3 space-y-2"
              style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
              <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
              <button
                onClick={handleSend}
                className="text-xs tracking-[0.2em] uppercase transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)' }}
              >
                Retry →
              </button>
            </div>
          )}

          <ScriptDocumentView script={script} onChange={setScript} />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between py-5" style={{ width: 720, margin: '0 auto' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            All fields are editable before sending.
          </p>
          <button
            onClick={handleSend}
            disabled={pageState === 'creating'}
            className="px-8 py-3 text-sm font-medium tracking-[0.2em] uppercase transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-3"
            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)', borderRadius: 2 }}
            onMouseEnter={e => { if (pageState !== 'creating') e.currentTarget.style.background = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--text-primary)' }}
          >
            {pageState === 'creating' ? (
              <>
                <span
                  className="inline-block h-3 w-3 rounded-full border-t animate-spin"
                  style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                />
                Creating project…
              </>
            ) : (
              'Build Storyboard →'
            )}
          </button>
        </div>
      </div>
    </main>
  )
}
