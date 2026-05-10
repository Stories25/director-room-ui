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
