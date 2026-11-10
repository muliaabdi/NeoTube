import { observable } from '@legendapp/state'

export type DownloadPhase = 'downloading' | 'done' | 'error'

export interface DownloadState {
  url: string
  title: string
  phase: DownloadPhase
  progress: number
  progressLine: string
  errorMsg: string
  savedPath: string
  // What was downloaded, kept so the local playback index can be written when
  // the file lands (states/downloads-index.ts).
  formatId: string
  audioOnly: boolean
}

export const downloads$ = observable<Record<string, DownloadState>>({})
