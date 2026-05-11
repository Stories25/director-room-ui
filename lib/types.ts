export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting'
export type ShotType = 'ECU' | 'CU' | 'MCU' | 'MS' | 'WS' | 'EWS' | 'POV' | 'INSERT'
export type LocationType = 'INT' | 'EXT'

export interface ScriptCharacter {
  name: string
  role: CharacterRole
  description: string
}

export interface Shot {
  number: number
  location_type: LocationType
  location: string
  time_of_day: string
  shot_type: ShotType
  duration_seconds: number
  action: string
  dialogue?: string
  direction?: string // camera/performance note
}

export interface ScriptDocument {
  title: string
  logline: string
  genre: string
  tone: string
  duration: '30 seconds'
  characters: ScriptCharacter[]
  shots: Shot[]
  visual_style: string
  narrative_arc: string
  // Legacy field kept for backwards compat during transition
  scene?: {
    setting: string
    time_of_day: string
    mood: string
    action: string
    dialogue_hints: string[]
  }
}

export interface TranscriptEntry {
  speaker: 'HANK' | 'YOU'
  text: string
  timestamp: number
}

export interface SessionCredentials {
  sessionId: string
  serverUrl: string
  token: string
  roomName: string
}

// Storyboard types
export interface StoryboardShotImage {
  version: number
  grid_no: number | null
  url: string
  created_at: number
  upscaled?: boolean
  upscale_target_res?: string
  source_image_version?: number
}

export interface StoryboardShotData {
  description: string
  casting: string
  location: string
  framing: string
  duration: string
  dialogue: string[]
  actions: string[]
  mood: string
  time_of_day: string
  lighting: string
  camera_movement: string
}

export type VideoGenStatus = 'pending' | 'processing' | 'succeeded' | 'failed'

export interface StoryboardShotVideoGeneration {
  task_id: string
  status: VideoGenStatus
  url?: string
  prompt?: string
  created_at: number
}

export interface StoryboardShot {
  script_data: StoryboardShotData
  image: {
    active: number
    generations: StoryboardShotImage[]
  }
  video?: {
    active: number
    generations: StoryboardShotVideoGeneration[]
  }
}

export interface StoryboardResult {
  projectId: string
  projectTitle?: string
  shots: Record<string, StoryboardShot>
  activeGrid: number
}

// ─── Batch video types ─────────────────────────────────────────────────────

export interface BatchVideoFireResult {
  fired_count: number
  failed_count: number
  skipped_count: number
  failures: Array<{ shot_id: string; reason?: string }>
  skipped: Array<{ shot_id: string; reason: string }>
  tasks: Array<{ shot_id: string; task_id: string; status: string }>
  model: string
  duration: number
  ratio: string
}

export interface BatchVideoStatusResult {
  shots_status: Record<string, {
    task_id: string
    status: string
    video_url: string | null
  }>
  all_done: boolean
  checked_count: number
}

export interface VideoGenConfig {
  model: string
  duration: number
  ratio: string
}

// ─── BGM (Background Music) types ───────────────────────────────────────────

export interface BgmTimestamp {
  shot_id: string
  start_ms: number
  end_ms: number
  energy: number           // 1–5
  volume: number           // 0.0–1.0
  dynamic_note: string     // 'INTRO' | 'RISE' | 'PEAK' | 'FALL' | 'FADE'
  emotional_beat: string
  music_direction: string
}

export interface Bgm {
  id: string
  url: string              // direct .mp3, playable in <audio>
  prompt: string
  properties: Record<string, unknown>
  timestamps: BgmTimestamp[]
  duration_ms: number
}

// ─── Legacy video types (kept for argon.ts compat) ──────────────────────────

export type VideoClipStatus = 'pending' | 'generating' | 'ready' | 'error'

export type TransitionType = 'cut' | 'crossfade' | 'fade_black' | 'wipe_left' | 'wipe_right'

export interface ClipTransition {
  type: TransitionType
  durationMs: number
}

export interface TimelineState {
  clipOrder: string[]
  transitions: Record<string, ClipTransition>
}

export interface VideoClip {
  shotKey: string
  duration: number
  status: VideoClipStatus
  url?: string
  prompt: string
  thumbnailUrl?: string
}

export interface VideoResult {
  projectId: string
  clips: VideoClip[]
  totalDuration: number
  status: VideoClipStatus
  compiledUrl?: string
}

// ─── Video helpers ─────────────────────────────────────────────────────────

export function isVideoAll(shots: Record<string, StoryboardShot>): boolean {
  const keys = Object.keys(shots)
  if (keys.length === 0) return false
  return keys.every(key => {
    const gens = shots[key].video?.generations
    if (!gens || gens.length === 0) return false
    const active = shots[key].video!.active
    const gen = gens.find(g => g.task_id === String(active)) ?? gens[gens.length - 1]
    return gen?.status === 'succeeded'
  })
}

export function getPendingVideoTasks(shots: Record<string, StoryboardShot>): { shotKey: string; taskId: string }[] {
  const tasks: { shotKey: string; taskId: string }[] = []
  for (const [key, shot] of Object.entries(shots)) {
    const gens = shot.video?.generations
    if (!gens) continue
    for (const gen of gens) {
      if (gen.status === 'pending' || gen.status === 'processing') {
        tasks.push({ shotKey: key, taskId: gen.task_id })
      }
    }
  }
  return tasks
}

// ─── Sound types ────────────────────────────────────────────────────────────

export type SoundTrackMood = 'epic' | 'tense' | 'melancholic' | 'uplifting' | 'mysterious' | 'romantic' | 'minimal'

export interface SoundVariation {
  id: string
  name: string
  mood: SoundTrackMood
  duration: number
  url: string | null        // null until real backend returns audio
  waveformSeed: number      // deterministic seed for procedural waveform bars
}

export interface SoundBrief {
  tone: string
  mood: string
  narrativeArc: string
  visualStyle: string
  genre: string
  duration: string
  additionalDirection: string
}

export interface SoundResult {
  projectId: string
  prompt: string
  additionalDirection: string | null
  variations: SoundVariation[]
  approvedVariationId: string | null
  status: 'pending' | 'generating' | 'ready' | 'error'
}

/** Legacy — kept for import compat */
export interface SoundTrack {
  id: string
  name: string
  mood: SoundTrackMood
  duration: number
  url?: string
}

/**
 * Derive whether every shot has been upscaled by checking the active generation
 * for each shot. Returns false if there are no shots.
 */
export function isUpscaledAll(shots: Record<string, StoryboardShot>): boolean {
  const keys = Object.keys(shots)
  if (keys.length === 0) return false
  return keys.every(key => {
    const shot = shots[key]
    const { active, generations } = shot.image
    if (!generations || generations.length === 0) return false
    const activeGen = generations.find(g => g.version === active) ?? generations[generations.length - 1]
    return activeGen?.upscaled === true
  })
}
