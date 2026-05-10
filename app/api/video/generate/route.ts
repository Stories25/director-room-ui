import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/video/generate
 * Body: { projectId: string, shots: Record<string, StoryboardShot> }
 *
 * Stub: returns a mock VideoResult with clips derived from storyboard shots.
 * When the real backend is ready, swap this to call Argon.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, shots } = await request.json()
    if (!projectId || !shots) {
      return NextResponse.json({ error: 'Missing projectId or shots' }, { status: 400 })
    }

    const shotKeys = Object.keys(shots).sort((a, b) => {
      const [aS, aF] = a.split('.').map(Number)
      const [bS, bF] = b.split('.').map(Number)
      return aS !== bS ? aS - bS : aF - bF
    })

    // Distribute ~30s across available shots (3-4s each)
    const baseDuration = Math.floor(30 / Math.max(shotKeys.length, 1))
    const clips = shotKeys.map((key, i) => {
      const shot = shots[key]
      const duration = i === shotKeys.length - 1
        ? Math.max(3, 30 - baseDuration * (shotKeys.length - 1))
        : baseDuration
      return {
        shotKey: key,
        duration,
        status: 'ready' as const,
        prompt: shot.script_data?.description || `Shot ${key}`,
        thumbnailUrl: shot.image?.generations?.[shot.image.generations.length - 1]?.url || null,
        url: null, // real video URL will come from backend
      }
    })

    return NextResponse.json({
      video: {
        projectId,
        clips,
        totalDuration: clips.reduce((s, c) => s + c.duration, 0),
        status: 'ready',
      },
    })
  } catch (error) {
    console.error('[video/generate] Error:', error)
    return NextResponse.json({ error: 'Failed to generate video', details: String(error) }, { status: 500 })
  }
}
