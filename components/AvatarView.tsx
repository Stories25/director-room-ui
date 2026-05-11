'use client'

import { useEffect, useCallback } from 'react'
import {
  AvatarSession,
  AvatarVideo,
  useAvatarSession,
  useLocalMedia,
  useTranscription,
} from '@runwayml/avatars-react'
import '@runwayml/avatars-react/styles.css'
import { SessionCredentials, TranscriptEntry } from '@/lib/types'

interface AvatarCallUIProps {
  onTranscriptUpdate: (entry: TranscriptEntry) => void
  onMicStateChange: (active: boolean, muted: boolean) => void
  onEnd: (sessionId: string) => void
  onActive: () => void
  sessionId: string
}

function AvatarCallUI({ onTranscriptUpdate, onMicStateChange, onEnd, onActive, sessionId }: AvatarCallUIProps) {
  const { state, end } = useAvatarSession()
  const { isMicEnabled } = useLocalMedia()

  // Report mic state to parent
  useEffect(() => {
    const isActive = state === 'active'
    onMicStateChange(isActive, !isMicEnabled)
  }, [state, isMicEnabled, onMicStateChange])

  // Notify parent when session becomes active (avatar ready)
  useEffect(() => {
    if (state === 'active') {
      onActive()
    }
  }, [state, onActive])

  // Listen to transcript via the correct SDK hook
  // participantIdentity === 'agent' means Hank is speaking; anything else is the user
  useTranscription(
    useCallback(
      (entry) => {
        if (!entry.final) return // only capture finalized segments
        const speaker = entry.participantIdentity === 'agent' ? 'HANK' : 'YOU'
        onTranscriptUpdate({
          speaker,
          text: entry.text,
          timestamp: Date.now(),
        })
      },
      [onTranscriptUpdate]
    ),
    { interim: false }
  )

  // Listen for the finish event dispatched from the room page
  const handleEnd = useCallback(async () => {
    await end()
    onEnd(sessionId)
  }, [end, onEnd, sessionId])

  useEffect(() => {
    const listener = () => handleEnd()
    window.addEventListener('director-finish', listener)
    return () => window.removeEventListener('director-finish', listener)
  }, [handleEnd])

  return (
    <div className="relative h-full w-full">
      {/* Avatar video — centered and zoomed to frame the face */}
      <AvatarVideo
        className="h-full w-full"
        style={{
          objectFit: 'cover',
          objectPosition: 'center 25%',
          transform: 'scale(1.15)',
        }}
      />

      {/* Vignette overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(8,8,8,0.6) 100%)',
        }}
      />

      {/* Connecting state overlay */}
      {state === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#080808]">
          <p className="text-xs tracking-[0.3em] uppercase breathe" style={{ color: '#3a3a3a' }}>
            Connecting...
          </p>
        </div>
      )}
    </div>
  )
}

interface AvatarViewProps {
  credentials: SessionCredentials
  onTranscriptUpdate: (entry: TranscriptEntry) => void
  onMicStateChange: (active: boolean, muted: boolean) => void
  onSessionEnded: (sessionId: string) => void
  onSessionActive?: () => void
}

export default function AvatarView({
  credentials,
  onTranscriptUpdate,
  onMicStateChange,
  onSessionEnded,
  onSessionActive,
}: AvatarViewProps) {
  return (
    <AvatarSession
      credentials={credentials}
      audio
      video={false}
    >
      <AvatarCallUI
        onTranscriptUpdate={onTranscriptUpdate}
        onMicStateChange={onMicStateChange}
        onEnd={onSessionEnded}
        onActive={onSessionActive ?? (() => {})}
        sessionId={credentials.sessionId}
      />
    </AvatarSession>
  )
}
