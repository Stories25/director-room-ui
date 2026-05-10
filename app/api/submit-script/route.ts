/**
 * @deprecated The frontend now drives the Argon pipeline directly via lib/argon-browser.ts.
 * Steps are orchestrated in app/storyboard/[id]/page.tsx with per-step UI in components/StoryboardWaiting.tsx.
 * This route is kept for backwards compatibility only — remove after one release cycle.
 */
import { NextRequest, NextResponse } from 'next/server'
import { ScriptDocument } from '@/lib/types'
import { buildPrompt, createProject, generateScript, generateStoryboard } from '@/lib/argon'

// Pipeline takes ~2-3 minutes total — extend Next.js route timeout to 5 minutes
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const { script }: { script: ScriptDocument } = await request.json()
    if (!script) {
      return NextResponse.json({ error: 'script is required' }, { status: 400 })
    }

    const prompt = buildPrompt(script)
    const title  = script.title || "Director's Room Teaser"

    console.log('[submit-script] Step 1: Creating project...')
    const projectId = await createProject(title, prompt)
    console.log('[submit-script] Project created:', projectId)

    console.log('[submit-script] Step 2: Generating script...')
    await generateScript(projectId)
    console.log('[submit-script] Script generated')

    console.log('[submit-script] Step 3: Generating storyboard...')
    const storyboard = await generateStoryboard(projectId)
    console.log('[submit-script] Storyboard done:', Object.keys(storyboard.shots).length, 'shots')

    return NextResponse.json({ status: 'complete', projectId, storyboard })
  } catch (error) {
    console.error('[submit-script] Pipeline error:', error)
    return NextResponse.json(
      { error: 'Pipeline failed', details: String(error) },
      { status: 500 }
    )
  }
}
