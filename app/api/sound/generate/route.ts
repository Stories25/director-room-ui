import { NextRequest, NextResponse } from 'next/server'
import { generateMusic } from '@/lib/argon'

/**
 * POST /api/sound/generate
 * Body: { projectId: string }
 *
 * Proxies to POST /runway/projects/:id/storyboard/music on Argon.
 * The API is synchronous — returns new BGM tracks directly.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json()
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }
    const bgms = await generateMusic(projectId)
    return NextResponse.json({ bgms })
  } catch (error) {
    console.error('[sound/generate] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate music', details: String(error) },
      { status: 500 }
    )
  }
}
