'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Music, Play, ArrowRight, ArrowLeft, Loader2, AlertCircle, Volume2, Download, Check, Film } from 'lucide-react'
import type { SoundResult, SoundTrack, SoundTrackMood, StoryboardResult, VideoResult } from '@/lib/types'
import { Sprocket, TopBar } from '@/components/shell/Shell'
import WorkflowStepper from '@/components/WorkflowStepper'
import Button from '@/components/ui/Button'

const MOOD_LABELS: Record<SoundTrackMood, string> = {
  epic: 'Epic',
  tense: 'Tense',
  melancholic: 'Melancholic',
  uplifting: 'Uplifting',
  mysterious: 'Mysterious',
  romantic: 'Romantic',
  minimal: 'Minimal',
}

const MOOD_COLORS: Record<SoundTrackMood, string> = {
  epic: '#aa8844',
  tense: '#8a6a3a',
  melancholic: '#5a7a8a',
  uplifting: '#5a8a5a',
  mysterious: '#6a5a8a',
  romantic: '#8a5a6a',
  minimal: '#555555',
}

function readSessionVideo(): VideoResult | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-video')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

function readSessionSound(): SoundResult | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-sound')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

function readSessionStoryboard(): StoryboardResult | null {
  if (typeof window === 'undefined') return null
  const stored = sessionStorage.getItem('directors-room-storyboard')
  if (!stored) return null
  try { return JSON.parse(stored) } catch { return null }
}

export default function SoundPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string

  const [video, setVideo] = useState<VideoResult | null>(readSessionVideo)
  const [sound, setSound] = useState<SoundResult | null>(readSessionSound)
  const [tracks, setTracks] = useState<SoundTrack[]>([])
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'mixing' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cachedVideo = readSessionVideo()
    const cachedSound = readSessionSound()
    const cachedStoryboard = readSessionStoryboard()

    if (cachedSound && cachedSound.projectId === projectId) {
      setSound(cachedSound)
    }
    if (cachedVideo) setVideo(cachedVideo)

    // Load tracks
    fetch('/api/sound/tracks')
      .then(r => r.json())
      .then(data => {
        setTracks(data.tracks)
      })
      .catch(console.error)
      .finally(() => setPageState('ready'))
  }, [projectId])

  const handleMix = useCallback(async () => {
    if (!selectedTrackId) return
    setError(null)
    setPageState('mixing')
    try {
      const res = await fetch('/api/sound/mix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, trackId: selectedTrackId }),
      })
      if (!res.ok) throw new Error('Sound mixing failed')
      const { sound: result } = await res.json()
      sessionStorage.setItem('directors-room-sound', JSON.stringify(result))
      setSound(result)
      setPageState('ready')
    } catch (err) {
      console.error('[sound] Mix failed:', err)
      setError(String(err))
      setPageState('ready')
    }
  }, [projectId, selectedTrackId])

  const selectedTrack = tracks.find(t => t.id === selectedTrackId)
  const isMixed = sound?.status === 'ready'

  if (pageState === 'loading') {
    return (
      <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
        <Sprocket />
        <TopBar breadcrumb={[{ label: 'Projects', href: '/' }, { label: 'Sound', current: true }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <Sprocket />

      <TopBar
        breadcrumb={[
          { label: 'Projects', href: '/' },
          { label: 'Video', href: `/video/${projectId}` },
          { label: 'Sound', current: true },
        ]}
      />

      <WorkflowStepper current="sound" projectId={projectId} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto w-full">
        <div style={{ width: 1080, margin: '0 auto', paddingTop: 32, paddingBottom: 80 }}>

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-xs tracking-[0.2em] uppercase font-slate mb-1" style={{ color: 'var(--text-muted)' }}>
                Step 5 of 5
              </p>
              <h1 className="text-2xl font-display font-light" style={{ color: 'var(--text-primary)' }}>
                Sound Engineering
              </h1>
            </div>
            {isMixed && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded border" style={{ borderColor: 'rgba(90,138,90,0.3)', background: 'rgba(90,138,90,0.05)' }}>
                <Check className="w-3 h-3" style={{ color: 'var(--accent-green)' }} />
                <span className="text-[10px] font-slate" style={{ color: 'var(--accent-green)' }}>Mixed</span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded border px-4 py-3 flex items-center gap-3"
              style={{ borderColor: 'rgba(204,68,68,0.2)', background: 'rgba(204,68,68,0.05)' }}>
              <AlertCircle className="w-4 h-4 flex-none" style={{ color: 'var(--accent-red)' }} />
              <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
            </div>
          )}

          <div className="grid gap-8" style={{ gridTemplateColumns: '1fr 320px' }}>
            {/* Left: video preview + track list */}
            <div className="space-y-8">
              {/* Video preview placeholder */}
              <div className="rounded border overflow-hidden" style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}>
                <div className="relative" style={{ aspectRatio: '16/9', background: 'var(--surface-2)' }}>
                  {video?.clips?.[0]?.thumbnailUrl ? (
                    <img
                      src={video.clips[0].thumbnailUrl}
                      alt="Preview"
                      className="w-full h-full object-cover opacity-60"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <p className="text-xs font-slate" style={{ color: 'var(--text-muted)' }}>
                    {video?.totalDuration ? `${video.totalDuration}s preview` : 'No video generated'}
                  </p>
                  <Volume2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>

              {/* Track library */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold tracking-[0.3em] uppercase font-slate" style={{ color: 'var(--text-tertiary)' }}>
                    Music Library
                  </p>
                  <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
                </div>

                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {tracks.map(track => {
                    const isSelected = selectedTrackId === track.id
                    return (
                      <button
                        key={track.id}
                        onClick={() => setSelectedTrackId(track.id)}
                        className="text-left rounded border p-4 transition-all duration-200"
                        style={{
                          borderColor: isSelected ? 'var(--accent-amber)' : 'var(--border-standard)',
                          background: isSelected ? 'rgba(170,136,68,0.05)' : 'var(--surface-1)',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-emphasis)'
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-standard)'
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {track.name}
                          </p>
                          {isSelected && (
                            <Check className="w-4 h-4" style={{ color: 'var(--accent-amber)' }} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-slate"
                            style={{
                              background: `${MOOD_COLORS[track.mood]}15`,
                              color: MOOD_COLORS[track.mood],
                            }}
                          >
                            {MOOD_LABELS[track.mood]}
                          </span>
                          <span className="text-[10px] font-slate" style={{ color: 'var(--text-muted)' }}>
                            {track.duration}s
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right: action panel */}
            <div className="space-y-6">
              <div
                className="rounded border p-6 space-y-6 sticky top-8"
                style={{ borderColor: 'var(--border-standard)', background: 'var(--surface-1)' }}
              >
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-3" style={{ color: 'var(--text-tertiary)' }}>
                    Selected Track
                  </p>
                  {selectedTrack ? (
                    <div className="space-y-2">
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedTrack.name}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-slate"
                          style={{
                            background: `${MOOD_COLORS[selectedTrack.mood]}15`,
                            color: MOOD_COLORS[selectedTrack.mood],
                          }}
                        >
                          {MOOD_LABELS[selectedTrack.mood]}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                      Choose a track from the library
                    </p>
                  )}
                </div>

                <div className="h-px" style={{ background: 'var(--border-subtle)' }} />

                <Button
                  variant="primary"
                  size="md"
                  onClick={handleMix}
                  disabled={!selectedTrackId || pageState === 'mixing'}
                  className="w-full group gap-2"
                >
                  {pageState === 'mixing' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Mixing…
                    </>
                  ) : isMixed ? (
                    <>
                      <Check className="w-3 h-3" />
                      Remixed
                    </>
                  ) : (
                    <>
                      <Music className="w-3 h-3" />
                      Mix Sound <ArrowRight className="w-3 h-3 transition-transform duration-200 group-hover:translate-x-1" />
                    </>
                  )}
                </Button>

                {isMixed && (
                  <>
                    <div className="h-px" style={{ background: 'var(--border-subtle)' }} />
                    <Button variant="secondary" size="sm" className="w-full gap-2">
                      <Download className="w-3 h-3" /> Export Final Video
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex-none w-full border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--surface-1)' }}>
        <div className="flex items-center justify-between py-4" style={{ width: 1080, margin: '0 auto' }}>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/video/${projectId}`)}>
            <ArrowLeft className="w-3 h-3" /> Video
          </Button>
          <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
            <ArrowLeft className="w-3 h-3" /> All Projects
          </Button>
        </div>
      </div>
    </main>
  )
}
