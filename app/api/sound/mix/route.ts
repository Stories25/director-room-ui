import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/sound/mix
 * Body: { projectId: string, videoUrl?: string, trackId: string }
 *
 * Stub: returns a mock SoundResult.
 * When the real backend is ready, swap this to call Argon.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, trackId } = await request.json()
    if (!projectId || !trackId) {
      return NextResponse.json({ error: 'Missing projectId or trackId' }, { status: 400 })
    }

    return NextResponse.json({
      sound: {
        projectId,
        videoUrl: null, // populated by backend
        track: {
          id: trackId,
          name: 'Generated Track',
          mood: 'epic',
          duration: 30,
        },
        status: 'ready',
      },
    })
  } catch (error) {
    console.error('[sound/mix] Error:', error)
    return NextResponse.json({ error: 'Failed to mix sound', details: String(error) }, { status: 500 })
  }
}
