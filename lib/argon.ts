import type { ScriptDocument, StoryboardResult } from './types'

const BASE_URL  = process.env.ARGON_BASE_URL!
const AUTH_TOKEN = process.env.ARGON_AUTH_TOKEN!

function headers() {
  return {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

export function buildPrompt(script: ScriptDocument): string {
  const chars = script.characters
    .map(c => `${c.name} (${c.role}): ${c.description}`)
    .join('; ')

  const shots = (script.shots || [])
    .map(s =>
      `Shot ${s.number} (${s.duration_seconds}s, ${s.shot_type}, ${s.location_type}. ${s.location} - ${s.time_of_day}): ${s.action}` +
      (s.dialogue ? ` Dialogue: "${s.dialogue}"` : '') +
      (s.direction ? ` Direction: ${s.direction}` : '')
    )
    .join(' ')

  return [
    script.logline,
    `Genre: ${script.genre}. Tone: ${script.tone}.`,
    `Characters: ${chars}.`,
    `Visual style: ${script.visual_style}.`,
    `Narrative arc: ${script.narrative_arc}.`,
    `Shot breakdown: ${shots}`,
  ].filter(Boolean).join(' ')
}

// ─── Step 1: POST /runway/projects ──────────────────────────────────────────

export async function createProject(title: string, prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/runway/projects`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ title, prompt }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`createProject failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  // Handle both flat and nested response shapes
  const id =
    data?.id ??
    data?.data?.id ??
    data?.project_id ??
    data?.data?.project_id
  if (!id) throw new Error(`createProject: no project ID in response: ${JSON.stringify(data)}`)
  return id
}

// ─── Step 2: POST /runway/projects/:id/script ────────────────────────────────

export async function generateScript(projectId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/script`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`generateScript failed (${res.status}): ${err}`)
  }
}

// ─── Step 3: POST /runway/projects/:id/storyboard ───────────────────────────

export async function generateStoryboard(projectId: string): Promise<StoryboardResult> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/storyboard`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`generateStoryboard failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  const storyboard = data?.data?.storyboard ?? data?.storyboard
  if (!storyboard) throw new Error(`generateStoryboard: unexpected response: ${JSON.stringify(data)}`)
  return {
    projectId,
    shots: storyboard.shots,
    activeGrid: storyboard.active_grid,
  }
}
