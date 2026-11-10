import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'

// Videos downloaded through yt-dlp that can be replayed from local storage
// instead of streaming (see docs/superpowers/specs/2026-11-10-local-playback-design.md).
// Keyed by video id; the last download of a video wins.
export interface LocalVideoEntry {
  videoId: string
  // content:// URI (Android) or absolute path (Desktop).
  uri: string
  formatId: string
  title: string
  // Audio-only downloads never trigger the playback overlay.
  audioOnly: boolean
  downloadedAt: number
}

export const localVideos$ = observable<Record<string, LocalVideoEntry>>({})

export function recordDownloadedVideo(entry: Omit<LocalVideoEntry, 'downloadedAt'>) {
  localVideos$[entry.videoId].set({ ...entry, downloadedAt: Date.now() })
}

// Watch pages, Shorts and youtu.be links all name the video in the query
// string or the path; anything else has nothing to look up.
const VIDEO_ID = /^[\w-]{11}$/

export function extractVideoId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const fromQuery = parsed.searchParams.get('v')
  if (fromQuery && VIDEO_ID.test(fromQuery)) {
    return fromQuery
  }
  const segments = parsed.pathname.split('/').filter(Boolean)
  const last = segments[segments.length - 1]
  const hostIsShortlink = parsed.hostname === 'youtu.be'
  const pathNamesVideo = ['shorts', 'embed', 'live', 'v'].includes(segments[0] || '')
  if (last && VIDEO_ID.test(last) && (hostIsShortlink || pathNamesVideo)) {
    return last
  }
  return null
}

if (isWeb) {
  syncObservable(localVideos$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'localVideos',
      },
    },
  })
} else {
  syncObservable(localVideos$, {
    persist: {
      name: 'localVideos',
      plugin: ObservablePersistMMKV,
    },
  })
}
