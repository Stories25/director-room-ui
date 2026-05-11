import { NextRequest, NextResponse } from 'next/server'
import { generateMusic } from '@/lib/argon'

/**
 * POST /api/sound/generate
 * Body: { projectId: string }
 *
 * Proxies to POST /runway/projects/:id/storyboard/music on Argon.
 * The actual BGM result is returned asynchronously — poll GET /api/projects/:id
 * until project.storyboard.bgms is non-empty.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json()
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    await generateMusic(projectId)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[sound/generate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to trigger music generation', details: String(error) },
      { status: 500 }
    )
  }
}
