import type { ScriptDocument, StoryboardResult, VideoResult, SoundResult, Bgm } from './types'

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
  const id =
    data?.data?.project?.id ??
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

// ─── GET /runway/projects (list) ───────────────────────────────────────────

export interface ProjectListItem {
  id: string
  title: string
  created_at: string
  updated_at: string
  thumbnail_url: string | null
}

export interface ProjectDetail extends ProjectListItem {
  user_id: string
  input_script: string
  updated_script: string
  updated_at: string
  storyboard: {
    active_grid: number
    grids: Record<string, { url: string; created_at: number }>
    shots: Record<string, import('./types').StoryboardShot & { video?: { active: number; generations: unknown[] }; audio?: { active: number; generations: unknown[] } }>
  } | null
  bgms?: Bgm[]
}

export async function getProjects(): Promise<ProjectListItem[]> {
  const res = await fetch(`${BASE_URL}/runway/projects`, {
    method: 'GET',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`getProjects failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  const projects = data?.data?.projects ?? data?.projects ?? []
  return projects
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}`, {
    method: 'GET',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`getProject failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  const project = data?.data?.project ?? data?.project ?? data
  return project
}

// ─── Step 3: POST /runway/projects/:id/storyboard ───────────────────────────

export async function generateStoryboard(projectId: string): Promise<StoryboardResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 240_000)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}/runway/projects/${projectId}/storyboard`, {
      method: 'POST',
      headers: headers(),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
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

// ─── Music generation: POST /runway/projects/:id/storyboard/music ────────────

export async function generateMusic(projectId: string): Promise<Bgm[]> {
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/storyboard/music`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`generateMusic failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  const bgms: Bgm[] = data?.data?.bgms ?? data?.bgms ?? []
  return bgms
}

// ─── Step 4: Video generation (stub) ────────────────────────────────────────

export async function generateVideo(projectId: string): Promise<VideoResult> {
  // TODO: wire to Argon backend when API is ready
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/video`, {
    method: 'POST',
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`generateVideo failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data?.data?.video ?? data?.video
}

// ─── Step 5: Sound mixing (stub) ────────────────────────────────────────────

export async function mixSound(projectId: string, trackId: string): Promise<SoundResult> {
  // TODO: wire to Argon backend when API is ready
  const res = await fetch(`${BASE_URL}/runway/projects/${projectId}/sound`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ track_id: trackId }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`mixSound failed (${res.status}): ${err}`)
  }
  const data = await res.json()
  return data?.data?.sound ?? data?.sound
}
