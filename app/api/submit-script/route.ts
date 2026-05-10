import { NextRequest, NextResponse } from 'next/server'
import { ScriptDocument, StoryboardResult } from '@/lib/types'

// ─────────────────────────────────────────────────────────────────────────────
// TODO: When the backend pipeline is ready, replace the mock below with:
//
//   1. POST {BACKEND_URL}/runway/projects  → { title, prompt } → projectId
//   2. POST {BACKEND_URL}/runway/projects/:id/script            → (no body)
//   3. POST {BACKEND_URL}/runway/projects/:id/storyboard        → StoryboardResult
//
// The prompt should be built from the ScriptDocument using buildPrompt() below.
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(script: ScriptDocument): string {
  const characterList = script.characters
    .map(c => `${c.name} (${c.role}): ${c.description}`)
    .join('; ')

  const shotList = (script.shots || [])
    .map(s =>
      `Shot ${s.number} (${s.duration_seconds}s, ${s.shot_type}, ${s.location_type}. ${s.location}): ${s.action}` +
      (s.dialogue ? ` Dialogue: "${s.dialogue}"` : '')
    )
    .join(' ')

  return [
    script.logline,
    `Genre: ${script.genre}. Tone: ${script.tone}.`,
    `Characters: ${characterList}.`,
    `Visual style: ${script.visual_style}.`,
    `Narrative arc: ${script.narrative_arc}.`,
    `Shot breakdown: ${shotList}`,
  ].filter(Boolean).join(' ')
}

function buildMockStoryboard(script: ScriptDocument): StoryboardResult {
  const shots = script.shots || []
  const shotMap: StoryboardResult['shots'] = {}

  shots.forEach((shot, i) => {
    const section = Math.floor(i / 3) + 1
    const frame   = (i % 3) + 1
    const key     = `${section}.${frame}`

    shotMap[key] = {
      script_data: {
        description:     shot.action,
        casting:         script.characters.map(c => c.name).join(', ') || 'TBD',
        location:        `${shot.location_type}. ${shot.location}`,
        framing:         `${shot.shot_type}, Rule of Thirds`,
        duration:        `${shot.duration_seconds}s`,
        dialogue:        shot.dialogue ? [shot.dialogue] : [],
        actions:         [shot.action],
        mood:            script.tone,
        time_of_day:     shot.time_of_day,
        lighting:        'Cinematic lighting per visual style',
        camera_movement: shot.direction || 'Static',
      },
      image: {
        active: 0,
        generations: [],
      },
    }
  })

  return {
    projectId: `mock-${Date.now()}`,
    shots: shotMap,
    activeGrid: 1,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { script }: { script: ScriptDocument } = await request.json()

    if (!script) {
      return NextResponse.json({ error: 'script is required' }, { status: 400 })
    }

    // Log the prompt that will go to the backend when it's ready
    const prompt = buildPrompt(script)
    console.log('[submit-script] Prompt that will be sent to backend:')
    console.log(prompt)

    // Simulate pipeline latency (remove when real backend is wired)
    await new Promise(r => setTimeout(r, 1500))

    const storyboard = buildMockStoryboard(script)

    return NextResponse.json({
      status: 'complete',
      projectId: storyboard.projectId,
      storyboard,
    })
  } catch (error) {
    console.error('[submit-script] Error:', error)
    return NextResponse.json(
      { error: 'Failed to submit script', details: String(error) },
      { status: 500 }
    )
  }
}
