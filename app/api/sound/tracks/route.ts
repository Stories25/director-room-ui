import { NextResponse } from 'next/server'
import type { SoundTrackMood } from '@/lib/types'

interface TrackStub {
  id: string
  name: string
  mood: SoundTrackMood
  duration: number
}

const TRACKS: TrackStub[] = [
  { id: 'trk-epic-01', name: 'Rising Tide', mood: 'epic', duration: 30 },
  { id: 'trk-epic-02', name: 'Final Stand', mood: 'epic', duration: 32 },
  { id: 'trk-tense-01', name: 'Undercurrent', mood: 'tense', duration: 30 },
  { id: 'trk-tense-02', name: 'Nocturne', mood: 'tense', duration: 31 },
  { id: 'trk-mel-01', name: 'Distant Shore', mood: 'melancholic', duration: 30 },
  { id: 'trk-uplift-01', name: 'First Light', mood: 'uplifting', duration: 30 },
  { id: 'trk-myst-01', name: 'Veil of Mist', mood: 'mysterious', duration: 30 },
  { id: 'trk-rom-01', name: 'Silver Thread', mood: 'romantic', duration: 30 },
  { id: 'trk-min-01', name: 'Bare Bones', mood: 'minimal', duration: 30 },
]

/**
 * GET /api/sound/tracks
 * Returns the library of available music tracks.
 */
export async function GET() {
  return NextResponse.json({ tracks: TRACKS })
}
