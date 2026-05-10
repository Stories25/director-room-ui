export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting'

export interface ScriptCharacter {
  name: string
  role: CharacterRole
  description: string
}

export interface ScriptScene {
  setting: string
  time_of_day: string
  mood: string
  action: string
  dialogue_hints: string[]
}

export interface ScriptDocument {
  title: string
  logline: string
  genre: string
  tone: string
  duration: '30 seconds'
  characters: ScriptCharacter[]
  scene: ScriptScene
  visual_style: string
  narrative_arc: string
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
