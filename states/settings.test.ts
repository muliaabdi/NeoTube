import { describe, expect, it } from 'bun:test'
import { getSettingsSnapshot, normalizeSettings, type SettingsSnapshot } from './settings'

const normalizePartialSettings = () => normalizeSettings<Partial<SettingsSnapshot>>({})

describe('settings', () => {
  it('defaults landscape forcing off and accepts only boolean preferences', () => {
    expect(getSettingsSnapshot({}).forceLandscape).toBe(false)
    expect(normalizePartialSettings()?.forceLandscape).toBe(false)
    for (const forceLandscape of [true, false]) {
      expect(getSettingsSnapshot({ forceLandscape }).forceLandscape).toBe(forceLandscape)
      expect(normalizeSettings({ forceLandscape }).forceLandscape).toBe(forceLandscape)
    }
    for (const forceLandscape of ['true', 'false', 1, null]) {
      const data = { forceLandscape } as unknown as Partial<SettingsSnapshot>
      expect(getSettingsSnapshot(data).forceLandscape).toBe(false)
      expect(normalizeSettings(data)?.forceLandscape).toBe(false)
    }
  })

  it('defaults local playback on and accepts only boolean preferences', () => {
    expect(getSettingsSnapshot({}).localPlayback).toBe(true)
    expect(normalizePartialSettings()?.localPlayback).toBe(true)
    for (const localPlayback of [true, false]) {
      expect(getSettingsSnapshot({ localPlayback }).localPlayback).toBe(localPlayback)
      expect(normalizeSettings({ localPlayback }).localPlayback).toBe(localPlayback)
    }
    for (const localPlayback of ['true', 'false', 1, null]) {
      const data = { localPlayback } as unknown as Partial<SettingsSnapshot>
      expect(getSettingsSnapshot(data).localPlayback).toBe(true)
      expect(normalizeSettings(data)?.localPlayback).toBe(true)
    }
  })

  it('keeps proxy credentials out of backup and sync snapshots', () => {
    const snapshot = getSettingsSnapshot({ proxyUsername: 'device user', proxyPassword: 'device password' })
    expect(snapshot).not.toHaveProperty('proxyUsername')
    expect(snapshot).not.toHaveProperty('proxyPassword')
  })

  it('defaults disable autoplay off in snapshots and persisted settings', () => {
    expect(getSettingsSnapshot({}).disableAutoplay).toBe(false)
    expect(normalizePartialSettings()?.disableAutoplay).toBe(false)
  })

  it('preserves boolean disable autoplay preferences and rejects invalid values', () => {
    for (const disableAutoplay of [true, false]) {
      expect(getSettingsSnapshot({ disableAutoplay }).disableAutoplay).toBe(disableAutoplay)
      expect(normalizeSettings({ disableAutoplay }).disableAutoplay).toBe(disableAutoplay)
    }
    for (const disableAutoplay of ['true', 1, null]) {
      const data = { disableAutoplay } as unknown as Partial<SettingsSnapshot>
      expect(getSettingsSnapshot(data).disableAutoplay).toBe(false)
      expect(normalizeSettings(data)?.disableAutoplay).toBe(false)
    }
  })

  it('defaults original video title setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).showOriginalVideoTitle).toBe(false)
  })

  it('defaults show dislikes setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).showDislikes).toBe(false)
  })

  it('defaults the top bar to hidden and accepts only boolean preferences', () => {
    expect(getSettingsSnapshot({}).showHeader).toBe(false)
    expect(normalizePartialSettings()?.showHeader).toBe(false)
    for (const showHeader of [true, false]) {
      expect(getSettingsSnapshot({ showHeader }).showHeader).toBe(showHeader)
      expect(normalizeSettings({ showHeader })?.showHeader).toBe(showHeader)
    }
    for (const showHeader of ['true', 1, null]) {
      const data = { showHeader } as unknown as Partial<SettingsSnapshot>
      expect(getSettingsSnapshot(data).showHeader).toBe(false)
      expect(normalizeSettings(data)?.showHeader).toBe(false)
    }
  })

  it('defaults sponsor block categories to sponsor, selfpromo, interaction', () => {
    expect(getSettingsSnapshot({}).sponsorBlockCategories).toEqual(['sponsor', 'selfpromo', 'interaction'])
    expect(normalizePartialSettings()?.sponsorBlockCategories).toEqual(['sponsor', 'selfpromo', 'interaction'])
  })

  it('filters unknown sponsor block categories and keeps explicit empty selections', () => {
    const data = { sponsorBlockCategories: ['sponsor', 'bogus', 'intro'] } as Partial<SettingsSnapshot>
    expect(getSettingsSnapshot(data).sponsorBlockCategories).toEqual(['sponsor', 'intro'])
    expect(normalizeSettings(data)?.sponsorBlockCategories).toEqual(['sponsor', 'intro'])
    expect(getSettingsSnapshot({ sponsorBlockCategories: [] }).sponsorBlockCategories).toEqual([])
  })

  it('normalizes content country to uppercase ISO codes or null', () => {
    expect(normalizeSettings({ contentCountry: 'id' } as Partial<SettingsSnapshot>)?.contentCountry).toBe('ID')
    expect(getSettingsSnapshot({ contentCountry: 'id' }).contentCountry).toBe('ID')
    expect(getSettingsSnapshot({}).contentCountry).toBeNull()
    for (const contentCountry of ['xyz', 'i', '1a', 12, true, '']) {
      const data = { contentCountry } as unknown as Partial<SettingsSnapshot>
      expect(getSettingsSnapshot(data).contentCountry).toBeNull()
      expect(normalizeSettings(data)?.contentCountry).toBeNull()
    }
  })

  it('defaults opening settings on launch to on and only turns off when explicitly false', () => {
    expect(getSettingsSnapshot({}).openSettingsOnLaunch).toBe(true)
    expect(normalizePartialSettings()?.openSettingsOnLaunch).toBe(true)
    expect(getSettingsSnapshot({ openSettingsOnLaunch: false }).openSettingsOnLaunch).toBe(false)
    expect(normalizeSettings({ openSettingsOnLaunch: false })?.openSettingsOnLaunch).toBe(false)
    for (const openSettingsOnLaunch of ['false', 0, null]) {
      const data = { openSettingsOnLaunch } as unknown as Partial<SettingsSnapshot>
      expect(getSettingsSnapshot(data).openSettingsOnLaunch).toBe(true)
      expect(normalizeSettings(data)?.openSettingsOnLaunch).toBe(true)
    }
  })

  it('defaults desktop sidebar autohide setting off in snapshots', () => {
    expect(getSettingsSnapshot({}).autoHideSidebar).toBe(false)
  })

  it('defaults pull to refresh setting on in snapshots', () => {
    expect(getSettingsSnapshot({}).pullToRefreshEnabled).toBe(true)
  })

  it('defaults text zoom to 100 in snapshots', () => {
    expect(getSettingsSnapshot({}).defaultZoom).toBe(100)
  })

  it('defaults double-tap translation off with no target language', () => {
    expect(getSettingsSnapshot({}).translateComments).toBe(false)
    expect(getSettingsSnapshot({}).translationTargetLanguage).toBeNull()
  })

  it('normalizes missing original video title setting to false', () => {
    const settings = normalizePartialSettings()
    expect(settings?.showOriginalVideoTitle).toBe(false)
  })

  it('normalizes missing show dislikes setting to false', () => {
    const settings = normalizePartialSettings()
    expect(settings?.showDislikes).toBe(false)
  })

  it('normalizes missing desktop sidebar autohide setting to false', () => {
    const settings = normalizePartialSettings()
    expect(settings?.autoHideSidebar).toBe(false)
  })

  it('normalizes missing pull to refresh setting to true', () => {
    const settings = normalizePartialSettings()
    expect(settings?.pullToRefreshEnabled).toBe(true)
  })

  it('normalizes missing text zoom to 100', () => {
    const settings = normalizePartialSettings()
    expect(settings?.defaultZoom).toBe(100)
  })

  it('normalizes invalid double-tap translation settings', () => {
    const settings = normalizeSettings<Partial<SettingsSnapshot>>({
      translateComments: undefined,
      translationTargetLanguage: '   ',
    })
    expect(settings?.translateComments).toBe(false)
    expect(settings?.translationTargetLanguage).toBeNull()
  })

  it('carries the old mini player corner over to a position', () => {
    const settings = normalizeSettings({ miniPlayerCorner: 'top-left' } as Partial<SettingsSnapshot>)
    expect(settings?.miniPlayerPosition).toEqual({ x: 0, y: 0 })
    expect(getSettingsSnapshot({}).miniPlayerPosition).toEqual({ x: 1, y: 1 })
  })

  it('clamps an out-of-range mini player position', () => {
    const settings = normalizeSettings<Partial<SettingsSnapshot>>({ miniPlayerPosition: { x: 2, y: -1 } })
    expect(settings?.miniPlayerPosition).toEqual({ x: 1, y: 0 })
  })

  it('defaults every navbar button on', () => {
    const snapshot = getSettingsSnapshot({})
    expect(snapshot.showBackButtonInHeader).toBe(true)
    expect(snapshot.showForwardButtonInHeader).toBe(true)
    expect(snapshot.showReloadButtonInHeader).toBe(true)
    expect(snapshot.showHomeButtonInHeader).toBe(true)
    expect(snapshot.showHistoryButtonInHeader).toBe(true)
    expect(snapshot.showLibraryButtonInHeader).toBe(true)
    expect(snapshot.showStarButtonInHeader).toBe(true)
  })
})
