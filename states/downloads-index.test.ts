import { describe, it, expect, beforeEach } from 'bun:test'
import { extractVideoId, localVideos$, recordDownloadedVideo } from './downloads-index'

describe('downloads-index', () => {
  beforeEach(() => {
    localVideos$.set({})
  })

  it('extracts videoId from watch URL, shorts, and youtu.be', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://www.youtube.com/feed/subscriptions')).toBeNull()
  })

  it('records downloaded video with audioOnly flag derived from formatId', () => {
    recordDownloadedVideo({
      videoId: 'abc123xyz',
      uri: '/path/to/video.mp4',
      formatId: 'bestvideo+bestaudio/best',
      title: 'Sample Video',
      audioOnly: false,
    })
    const entry = localVideos$['abc123xyz'].get()
    expect(entry).toBeDefined()
    expect(entry.audioOnly).toBe(false)
    expect(entry.uri).toBe('/path/to/video.mp4')
  })

  it('flags mp3 and audio-only formats as audioOnly', () => {
    recordDownloadedVideo({
      videoId: 'aud123',
      uri: '/path/to/audio.mp3',
      formatId: 'bestaudio-mp3',
      title: 'Sample Audio',
      audioOnly: true,
    })
    expect(localVideos$['aud123'].get().audioOnly).toBe(true)
  })
})
