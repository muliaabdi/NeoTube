import { afterAll, afterEach, beforeAll, describe, expect, it, mock } from 'bun:test'

const setStoredSettings = (settings: unknown) => {
  ;(globalThis as any).localStorage = {
    store: new Map<string, string>(),
    getItem(key: string) {
      return this.store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      this.store.set(key, value)
    },
  }
  if (settings !== undefined) {
    ;(globalThis as any).localStorage.store.set('nou:settings', JSON.stringify(settings))
  }
}

describe('sponsorblock categories', () => {
  // content/utils.ts reads window.trustedTypes at import time; the module is
  // only ever loaded inside a webview, so stub the global before importing.
  let getSponsorBlockCategories: () => string[]
  let getSkipSegments: (videoId: string, categories: string[]) => Promise<{ videoId: string; segments: unknown[] }>
  let DEFAULT_SPONSOR_BLOCK_CATEGORIES: string[]

  beforeAll(async () => {
    ;(globalThis as any).window = globalThis
    ;(globalThis as any).document = { location: { host: 'm.youtube.com', pathname: '/' } }
    ;({ getSponsorBlockCategories, getSkipSegments, DEFAULT_SPONSOR_BLOCK_CATEGORIES } = await import(
      './sponsorblock'
    ))
  })

  afterAll(() => {
    delete (globalThis as any).window
    delete (globalThis as any).document
  })

  afterEach(() => {
    delete (globalThis as any).localStorage
  })

  it('falls back to the default categories without stored settings', () => {
    setStoredSettings(undefined)
    expect(getSponsorBlockCategories()).toEqual(DEFAULT_SPONSOR_BLOCK_CATEGORIES)
    expect(DEFAULT_SPONSOR_BLOCK_CATEGORIES).toEqual(['sponsor', 'selfpromo', 'interaction'])
  })

  it('reads the selected categories from stored settings', () => {
    setStoredSettings({ sponsorBlockCategories: ['sponsor', 'intro'] })
    expect(getSponsorBlockCategories()).toEqual(['sponsor', 'intro'])
  })

  it('keeps an explicit empty selection', () => {
    setStoredSettings({ sponsorBlockCategories: [] })
    expect(getSponsorBlockCategories()).toEqual([])
  })

  it('requests only the selected categories from the API', async () => {
    setStoredSettings({ sponsorBlock: true })
    const fetchMock = mock(async () => new Response('[]'))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as any
    try {
      const result = await getSkipSegments('abc', ['sponsor', 'intro'])
      expect(result).toEqual({ videoId: 'abc', segments: [] })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const url = (fetchMock.mock.calls[0][0] as string).toString()
      expect(url).toContain('videoID=abc')
      expect(url).toContain(`categories=${encodeURIComponent('["sponsor","intro"]')}`)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('skips the API entirely when no category is selected', async () => {
    setStoredSettings({ sponsorBlockCategories: [] })
    const fetchMock = mock(async () => new Response('[]'))
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as any
    try {
      const result = await getSkipSegments('abc', [])
      expect(result).toEqual({ videoId: 'abc', segments: [] })
      expect(fetchMock).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
