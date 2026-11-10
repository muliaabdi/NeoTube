import { describe, expect, test } from 'bun:test'
import { getNavbarButtons } from './content-settings'

describe('getNavbarButtons', () => {
  test('maps toolbar flags into navbar buttons', () => {
    expect(
      getNavbarButtons({
        showBackButtonInHeader: true,
        showForwardButtonInHeader: false,
        showReloadButtonInHeader: true,
        showHomeButtonInHeader: false,
        showHistoryButtonInHeader: true,
        showDownloadsButtonInHeader: true,
        showLibraryButtonInHeader: false,
        showStarButtonInHeader: true,
      }),
    ).toEqual({ back: true, forward: false, reload: true, home: false, downloads: true, history: true, library: false, star: true })
  })
})
