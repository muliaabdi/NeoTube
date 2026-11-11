import { describe, expect, it, beforeEach } from 'bun:test'
import { downloads$, listDownloads, removeDownload, type DownloadState } from './downloads'
import { localVideos$, recordDownloadedVideo } from './downloads-index'

const makeJob = (overrides: Partial<DownloadState>): DownloadState => ({
  url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Video',
  phase: 'done',
  progress: 100,
  progressLine: '',
  errorMsg: '',
  savedPath: 'content://media/external/downloads/1',
  formatId: 'bestvideo+bestaudio/best',
  audioOnly: false,
  ...overrides,
})

describe('downloads store helpers', () => {
  beforeEach(() => {
    downloads$.set({})
    localVideos$.set({})
  })

  it('lists active/recent downloads and appends localVideos$ entries missing from jobs', () => {
    const job1 = makeJob({ url: 'https://m.youtube.com/watch?v=aaaaaaaaaaa', title: 'Job 1' })
    const job2 = makeJob({
      url: 'https://m.youtube.com/watch?v=bbbbbbbbbbb',
      title: 'Job 2',
      phase: 'downloading',
      progress: 45,
    })
    downloads$[job1.url].set(job1)
    downloads$[job2.url].set(job2)

    recordDownloadedVideo({
      videoId: 'aaaaaaaaaaa',
      uri: job1.savedPath,
      formatId: job1.formatId,
      title: 'Indexed duplicate',
      audioOnly: false,
    })
    recordDownloadedVideo({
      videoId: 'ccccccccccc',
      uri: 'content://media/external/downloads/3',
      formatId: '18',
      title: 'Older Indexed Video',
      audioOnly: false,
    })

    const listed = listDownloads(downloads$.get(), localVideos$.get())
    expect(listed.map((d) => d.title)).toEqual(['Job 2', 'Job 1', 'Older Indexed Video'])
    expect(listed[2].url).toBe('https://m.youtube.com/watch?v=ccccccccccc')
    expect(listed[2].phase).toBe('done')
  })

  it('removes a download entry by url', () => {
    const job = makeJob({ url: 'https://m.youtube.com/watch?v=ddddddddddd', title: 'To remove' })
    downloads$[job.url].set(job)
    removeDownload(job.url)
    expect(downloads$.get()).toEqual({})
  })
})

