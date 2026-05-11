import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/sound/mix
 * Body: { projectId, prompt, additionalDirection? }
 *
 * Stub: returns 3–4 named track variations derived from the prompt.
 * When the real Runway/ElevenLabs backend is ready, swap this implementation.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, prompt, additionalDirection } = await request.json()
    if (!projectId || !prompt) {
      return NextResponse.json({ error: 'Missing projectId or prompt' }, { status: 400 })
    }

    // Simulate real API latency for the stub (remove in production)
    await new Promise(r => setTimeout(r, 8000))

    const variations = [
      {
        id: `${projectId}-v1`,
        name: 'Variation 1',
        mood: 'tense',
        duration: 30,
        url: null,      // real URL from Runway/ElevenLabs in production
        waveformSeed: 1,
      },
      {
        id: `${projectId}-v2`,
        name: 'Variation 2',
        mood: 'epic',
        duration: 30,
        url: null,
        waveformSeed: 2,
      },
      {
        id: `${projectId}-v3`,
        name: 'Variation 3',
        mood: 'melancholic',
        duration: 30,
        url: null,
        waveformSeed: 3,
      },
      {
        id: `${projectId}-v4`,
        name: 'Variation 4',
        mood: 'mysterious',
        duration: 30,
        url: null,
        waveformSeed: 4,
      },
    ]

    return NextResponse.json({
      sound: {
        projectId,
        prompt,
        additionalDirection: additionalDirection ?? null,
        variations,
        approvedVariationId: null,
        status: 'ready',
      },
    })
  } catch (error) {
    console.error('[sound/mix] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate soundtrack', details: String(error) },
      { status: 500 }
    )
  }
}
