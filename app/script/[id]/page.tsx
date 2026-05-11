'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ProjectDetail } from '@/lib/argon'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import Button from '@/components/ui/Button'
import WorkflowStepper from '@/components/WorkflowStepper'

type PageState = 'loading' | 'ready' | 'error'

export default function ScriptViewPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const [pageState, setPageState] = useState<PageState>('loading')
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (project?.title) {
      document.title = `${project.title} | Script`
    } else {
      document.title = "Script | Director's Room"
    }
  }, [project?.title])

  useEffect(() => {
    let cancelled = false
    async function fetchProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        if (!res.ok) throw new Error('Project not found')
        const { project } = await res.json()
        if (cancelled) return
        setProject(project)
        setPageState('ready')
      } catch (err) {
        if (cancelled) return
        console.error('[script/id] Fetch failed:', err)
        setError(String(err))
        setPageState('error')
      }
    }
    fetchProject()
    return () => { cancelled = true }
  }, [projectId])

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: project?.title ?? 'Script', current: true },
        ]}
      />

      <WorkflowStepper current="script" projectId={projectId} />

      {/* Scrollable document */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: 720, margin: '0 auto', padding: '40px 0 120px 0' }}>

          {pageState === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>Loading script...</p>
            </div>
          )}

          {pageState === 'error' && (
            <div className="mb-8 rounded border px-4 py-3 space-y-2"
              style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
              <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
              <Button variant="tertiary" size="sm" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </div>
          )}

          {pageState === 'ready' && project?.updated_script && (
            <div className="fade-up script-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{project.updated_script}</ReactMarkdown>
            </div>
          )}

          {pageState === 'ready' && !project?.updated_script && (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
              <p className="text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--text-muted)' }}>
                No script available
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between py-5" style={{ width: 720, margin: '0 auto' }}>
          <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="w-3 h-3" /> Projects
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push(`/storyboard/${projectId}`)}
            className="group gap-3"
          >
            <span className="flex items-center gap-2">
              Storyboard <ArrowRight className="w-3 h-3 inline-block transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </Button>
        </div>
      </div>

      <style jsx global>{`
        .script-markdown {
          color: var(--text-primary);
          font-family: inherit;
          line-height: 1.7;
        }
        .script-markdown h1 {
          font-size: 1.75rem;
          font-weight: 300;
          margin-bottom: 1rem;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }
        .script-markdown h2 {
          font-size: 1.25rem;
          font-weight: 400;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          color: var(--accent-amber);
          letter-spacing: 0.02em;
        }
        .script-markdown h3 {
          font-size: 1rem;
          font-weight: 500;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
        }
        .script-markdown p {
          margin-bottom: 1rem;
          font-weight: 300;
          color: var(--text-secondary);
        }
        .script-markdown strong {
          font-weight: 500;
          color: var(--text-primary);
        }
        .script-markdown em {
          font-style: italic;
          color: var(--text-tertiary);
        }
        .script-markdown ul, .script-markdown ol {
          margin-bottom: 1rem;
          padding-left: 1.25rem;
        }
        .script-markdown li {
          margin-bottom: 0.35rem;
          font-weight: 300;
          color: var(--text-secondary);
        }
        .script-markdown blockquote {
          border-left: 2px solid var(--accent-amber);
          padding-left: 1rem;
          margin: 1rem 0;
          color: var(--text-tertiary);
          font-style: italic;
        }
        .script-markdown hr {
          border: none;
          border-top: 1px solid var(--border-subtle);
          margin: 2rem 0;
        }
        .script-markdown code {
          font-size: 0.85em;
          background: var(--surface-2);
          padding: 0.15em 0.4em;
          border-radius: 3px;
        }
        .script-markdown pre {
          background: var(--surface-2);
          padding: 1rem;
          border-radius: 4px;
          overflow-x: auto;
          margin-bottom: 1rem;
        }
        .script-markdown pre code {
          background: transparent;
          padding: 0;
        }
        .script-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          font-size: 0.85rem;
        }
        .script-markdown th, .script-markdown td {
          border: 1px solid var(--border-subtle);
          padding: 0.75rem 1rem;
          text-align: left;
        }
        .script-markdown th {
          font-weight: 500;
          color: var(--text-primary);
          background: rgba(170, 136, 68, 0.05);
        }
        .script-markdown td {
          color: var(--text-secondary);
        }
      `}</style>
    </main>
  )
}
