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

export interface StoryboardShot {
  script_data: StoryboardShotData
  image: {
    active: number
    generations: StoryboardShotImage[]
  }
}

export interface StoryboardResult {
  projectId: string
  shots: Record<string, StoryboardShot>
  activeGrid: number
}

// ─── Video types ────────────────────────────────────────────────────────────

export type VideoClipStatus = 'pending' | 'generating' | 'ready' | 'error'

export interface VideoClip {
  shotKey: string
  duration: number // seconds
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
