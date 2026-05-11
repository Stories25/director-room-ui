/**
 * Browser-safe Argon client.
 * Calls Argon directly from the browser — token is intentionally public for now.
 * CORS is open (*) on the Argon server so direct calls are viable.
 */
import type { ScriptDocument, StoryboardResult, StoryboardShotVideoGeneration, SoundResult, SoundTrack } from './types'

const BASE_URL   = process.env.NEXT_PUBLIC_ARGON_BASE_URL!
const AUTH_TOKEN = process.env.NEXT_PUBLIC_ARGON_AUTH_TOKEN!

function headers() {
  return {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  }
}

// ─── Prompt builder (pure, no secrets) ───────────────────────────────────────

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

// ─── Step 1: POST /runway/projects ───────────────────────────────────────────

export async function createProject(title: string, prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/runway/projects`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ title, prompt }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to create project (${res.status}): ${err}`)
  }
  const data = await res.json()
  const id =
    data?.data?.project?.id ??
    data?.id ??
    data?.data?.id ??
    data?.project_id ??
    data?.data?.project_id
  if (!id) throw new Error(`No project ID in response: ${JSON.stringify(data)}`)
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
    throw new Error(`Failed to generate script (${res.status}): ${err}`)
  }
}

// ─── Upscale: POST /runway/projects/:id/storyboard/upscale ───────────────────

export async function upscaleStoryboard(projectId: string): Promise<StoryboardResult> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/storyboard/upscale`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ target_res: '2K', model_name: 'p-image-upscale' }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to upscale storyboard (${res.status}): ${err}`)
  }
  const data = await res.json()
  const storyboard = data?.data?.storyboard ?? data?.storyboard
  if (!storyboard) throw new Error(`Unexpected upscale response: ${JSON.stringify(data)}`)
  return {
    projectId,
    shots: storyboard.shots,
    activeGrid: storyboard.active_grid,
  }
}

// ─── Step 3: POST /runway/projects/:id/storyboard ────────────────────────────

export async function generateStoryboard(projectId: string): Promise<StoryboardResult> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/storyboard`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to generate storyboard (${res.status}): ${err}`)
  }
  const data = await res.json()
  const storyboard = data?.data?.storyboard ?? data?.storyboard
  if (!storyboard) throw new Error(`Unexpected storyboard response: ${JSON.stringify(data)}`)
  return {
    projectId,
    shots: storyboard.shots,
    activeGrid: storyboard.active_grid,
  }
}

// ─── Music generation: POST /runway/projects/:id/storyboard/music ────────────

export async function generateMusic(projectId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/storyboard/music`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to generate music (${res.status}): ${err}`)
  }
}

// ─── Step 4a: POST /runway/projects/:id/shots/:shotKey/video ──────────────

function normalizeVideoStatus(raw: string | undefined): import('./types').VideoGenStatus {
  switch ((raw ?? '').toLowerCase()) {
    case 'succeeded': return 'succeeded'
    case 'failed':    return 'failed'
    case 'processing':
    case 'running':   return 'processing'
    default:          return 'pending'
  }
}

export async function generateShotVideo(projectId: string, shotKey: string): Promise<StoryboardShotVideoGeneration> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/shots/${shotKey}/video`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to start video for shot ${shotKey} (${res.status}): ${err}`)
  }
  const data = await res.json()
  const gen = data?.data ?? data
  if (!gen?.task_id) throw new Error(`No task_id in video gen response: ${JSON.stringify(data)}`)
  return {
    task_id: gen.task_id,
    status: normalizeVideoStatus(gen.status),
    url: gen.video_url ?? undefined,
    prompt: gen.prompt ?? undefined,
    created_at: gen.created_at ?? Date.now(),
  }
}

export async function checkVideoTask(projectId: string, shotKey: string, taskId: string): Promise<StoryboardShotVideoGeneration> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/shots/${shotKey}/video-tasks/${taskId}`, {
    method: 'GET',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to check video task ${taskId} for shot ${shotKey} (${res.status}): ${err}`)
  }
  const data = await res.json()
  const gen = data?.data ?? data
  if (!gen?.task_id) throw new Error(`No task_id in video task response: ${JSON.stringify(data)}`)
  return {
    task_id: gen.task_id,
    status: normalizeVideoStatus(gen.status),
    url: gen.video_url ?? undefined,
    prompt: gen.prompt ?? undefined,
    created_at: gen.created_at ?? Date.now(),
  }
}

// ─── Step 5: POST /api/sound/mix (stub → will call Argon when ready) ─────────

export async function mixSound(projectId: string, trackId: string): Promise<SoundResult> {
  const res = await fetch('/api/sound/mix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, trackId }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to mix sound (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data.sound
}

// ─── GET /api/sound/tracks ──────────────────────────────────────────────────

export async function getSoundTracks(): Promise<SoundTrack[]> {
  const res = await fetch('/api/sound/tracks')
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to fetch tracks (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data.tracks
}
