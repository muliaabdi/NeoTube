import { settings$, type SettingsSnapshot } from '@/states/settings'
import { isWeb } from '@/lib/utils'

export const getNavbarButtons = (s: Pick<SettingsSnapshot, 'showBackButtonInHeader' | 'showForwardButtonInHeader' | 'showReloadButtonInHeader' | 'showHomeButtonInHeader' | 'showHistoryButtonInHeader' | 'showLibraryButtonInHeader' | 'showStarButtonInHeader'>) => ({
  back: s.showBackButtonInHeader,
  forward: s.showForwardButtonInHeader,
  reload: s.showReloadButtonInHeader,
  home: s.showHomeButtonInHeader,
  history: s.showHistoryButtonInHeader,
  library: s.showLibraryButtonInHeader,
  star: s.showStarButtonInHeader,
})

export const getContentSettingsSnapshot = () => {
  // Loaded lazily: the module chain pulls in expo, which breaks bun test.
  const { getSystemCaptionStyle } = require('@/lib/system-captions') as typeof import('@/lib/system-captions')
  const {
    sponsorBlock,
    sponsorBlockCategories,
    contentCountry,
    blockAds,
    playbackRate,
    playbackQuality,
    disableAutoplay,
    miniPlayer,
    pictureInPicture,
    showDislikes,
    showOriginalVideoTitle,
    doubleTapToToggleHeader,
    translateComments,
    translationTargetLanguage,
    replaceWatchNavigation,
    useSystemCaptionStyle,
  } = settings$.get()
  return {
    sponsorBlock,
    sponsorBlockCategories,
    contentCountry,
    blockAds,
    playbackRate,
    playbackQuality,
    disableAutoplay,
    miniPlayer,
    pictureInPicture,
    showDislikes,
    showOriginalVideoTitle,
    doubleTapToToggleHeader,
    translateComments: !isWeb && translateComments && Boolean(translationTargetLanguage),
    replaceWatchNavigation,
    captionStyle: useSystemCaptionStyle ? getSystemCaptionStyle() : null,
    navbarButtons: getNavbarButtons(settings$.get()),
  }
}
