import { ScriptDocument } from './types'

export type PipelineStep = 'project' | 'script' | 'storyboard' | 'video' | 'sound' | 'done'

export interface PipelineState {
  projectId: string
  script: ScriptDocument
  step: PipelineStep
  startedAt: number
}

const KEY = 'directors-room-pipeline'

export const pipelineState = {
  read(): PipelineState | null {
    if (typeof window === 'undefined') return null
    const stored = sessionStorage.getItem(KEY)
    if (!stored) return null
    try { return JSON.parse(stored) } catch { return null }
  },

  write(state: PipelineState): void {
    if (typeof window === 'undefined') return
    sessionStorage.setItem(KEY, JSON.stringify(state))
  },

  clear(): void {
    if (typeof window === 'undefined') return
    sessionStorage.removeItem(KEY)
  },
}
