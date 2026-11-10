import { afterEach, beforeAll, describe, expect, it } from 'bun:test'

// content/utils.ts touches window/document at module load; stub the page
// globals long enough to import the module, like lib/media-navigation.test.ts.
const names = ['window', 'document', 'location'] as const
const descriptors = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const)
const restore = () => {
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor)
    else Reflect.deleteProperty(globalThis, name)
  }
}

let localPlayback: typeof import('./local-playback')
beforeAll(async () => {
  Object.assign(globalThis, {
    window: { setTimeout, clearTimeout, top: null },
    document: { location: { host: 'm.youtube.com', pathname: '/watch', href: 'https://m.youtube.com/watch?v=vid1' } },
    location: new URL('https://m.youtube.com/watch?v=vid1'),
  })
  try {
    localPlayback = await import('./local-playback')
  } finally {
    restore()
  }
})
afterEach(restore)

describe('local playback gating', () => {
  const downloads = {
    vid1: { videoId: 'vid1', uri: 'file://x.mp4', formatId: 'f', title: 'T', audioOnly: false, downloadedAt: 1 },
    aud1: { videoId: 'aud1', uri: 'file://x.mp3', formatId: 'f', title: 'T', audioOnly: true, downloadedAt: 1 },
  }

  it('triggers only on /watch with localPlayback setting enabled and non-audio entry', () => {
    expect(localPlayback.shouldTriggerLocalPlayback('/watch', 'vid1', downloads, true)).toBe(true)
    expect(localPlayback.shouldTriggerLocalPlayback('/watch', 'vid1', downloads, false)).toBe(false)
    expect(localPlayback.shouldTriggerLocalPlayback('/watch', 'aud1', downloads, true)).toBe(false)
    expect(localPlayback.shouldTriggerLocalPlayback('/shorts/vid1', 'vid1', downloads, true)).toBe(false)
    expect(localPlayback.shouldTriggerLocalPlayback('/watch', 'unknown', downloads, true)).toBe(false)
  })

  it('reads the video id from a watch url', () => {
    expect(localPlayback.videoIdFromUrl('/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(localPlayback.videoIdFromUrl('/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ')
    expect(localPlayback.videoIdFromUrl('/watch')).toBeNull()
    expect(localPlayback.videoIdFromUrl('/feed/subscriptions')).toBeNull()
  })

  it('builds virtual origin URL correctly', () => {
    expect(localPlayback.getLocalVideoUrl('vid1')).toBe('https://noutube-assets.local/downloads/vid1')
  })
})
