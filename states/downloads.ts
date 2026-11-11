import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { isWeb } from '@/lib/utils'
import { extractVideoId, type LocalVideoEntry } from './downloads-index'
import { getIndexedDBPlugin } from './indexeddb'

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

export function removeDownload(url: string) {
  // Whole-record set() rather than key delete: sync-persisted observables
  // have flaky key-delete propagation.
  downloads$.set(Object.fromEntries(Object.entries(downloads$.get()).filter(([key]) => key !== url)))
}

export function listDownloads(
  jobsMap: Record<string, DownloadState> | undefined,
  videosMap: Record<string, LocalVideoEntry> | undefined,
): DownloadState[] {
  const jobs = Object.values(jobsMap || {}).reverse()
  const seenIds = new Set(jobs.map((item) => extractVideoId(item.url)).filter(Boolean))
  const fallback = Object.values(videosMap || {})
    .filter((entry) => !seenIds.has(entry.videoId))
    .sort((a, b) => (b.downloadedAt || 0) - (a.downloadedAt || 0))
    .map(
      (entry): DownloadState => ({
        url: `https://m.youtube.com/watch?v=${entry.videoId}`,
        title: entry.title || entry.videoId,
        phase: 'done',
        progress: 100,
        progressLine: '',
        errorMsg: '',
        savedPath: entry.uri,
        formatId: entry.formatId,
        audioOnly: entry.audioOnly,
      }),
    )
  return [...jobs, ...fallback]
}

// One list everywhere: the download history and the Downloads modal read this
// store, so it has to survive restarts like the playback index does.
if (isWeb) {
  syncObservable(downloads$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'downloads',
      },
    },
  })
} else {
  syncObservable(downloads$, {
    persist: {
      name: 'downloads',
      plugin: ObservablePersistMMKV,
    },
  })
}
