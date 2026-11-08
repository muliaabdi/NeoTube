import { emit, nouPolicy } from './utils'
import {
  iconNavbarArrowBack,
  iconNavbarArrowForward,
  iconNavbarHistory,
  iconNavbarHome,
  iconNavbarLibrary,
  iconNavbarReload,
  iconNavbarSettings,
} from './icons'

export type NavbarButtonFlags = {
  back?: boolean
  forward?: boolean
  reload?: boolean
  home?: boolean
  history?: boolean
  library?: boolean
  star?: boolean
}

type NavbarButton = { id: string; icon: string; run: () => void }

const emitAction = (action: string) => () => emit('navbar-action', { action })

// The pinned order of the column; `settings` is always last and always shown.
export function buildNavbarButtons(flags: NavbarButtonFlags): Array<NavbarButton | null> {
  return [
    flags.back ? { id: 'back', icon: iconNavbarArrowBack, run: () => history.back() } : null,
    flags.forward ? { id: 'forward', icon: iconNavbarArrowForward, run: () => history.forward() } : null,
    flags.reload ? { id: 'reload', icon: iconNavbarReload, run: () => location.reload() } : null,
    flags.home ? { id: 'home', icon: iconNavbarHome, run: () => location.assign('https://m.youtube.com/') } : null,
    flags.history ? { id: 'history', icon: iconNavbarHistory, run: emitAction('history') } : null,
    flags.library ? { id: 'library', icon: iconNavbarLibrary, run: emitAction('library') } : null,
    flags.star
      ? {
          id: 'star',
          icon: iconNavbarStar,
          run: () => {
            // Star needs a video; on home or between videos there is nothing to save.
            const url = window.NouTube?.getVideoUrl?.() || ''
            if (url) emit('star', { title: document.title, url })
          },
        }
      : null,
    { id: 'settings', icon: iconNavbarSettings, run: emitAction('settings') },
  ]
}

const iconNavbarStar = `<svg height="22" viewBox="0 0 24 24" width="22" fill="#e8e8e8" focusable="false" aria-hidden="true"><path d="m12 17.27 6.18 3.73-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`

const containerClass = '_nou_navbar_'
const standaloneStyle = [
  'position:fixed',
  'right:0',
  'bottom:55%',
  'display:flex',
  'flex-direction:column',
  'gap:2px',
  'padding:6px 0',
  'width:56px',
  'border-radius:20px 0 0 20px',
  'background:rgba(18,18,18,.9)',
  'backdrop-filter:blur(8px)',
  '-webkit-backdrop-filter:blur(8px)',
  'box-shadow:-4px 0 16px rgba(0,0,0,.4)',
  'border:1px solid rgba(255,255,255,.08)',
  'border-right:none',
  'z-index:9998',
].join(';')
const inPivotStyle = 'display:flex;flex-direction:column;gap:2px;padding:4px 0 2px;width:56px;margin:0 0 6px 0;border-bottom:1px solid rgba(255,255,255,.1)'

export function installNavbarButtons() {
  // The player webview is the video surface; its column would cover the video.
  // The embed modal loads a top-level /embed/ document (see isEmbedFrame) that
  // is all video too.
  if ((window as any).NouTubeRole === 'player' || document.location.pathname.startsWith('/embed/')) {
    return
  }

  const render = () => {
    let container = document.querySelector(`.${containerClass}`) as HTMLElement | null
    if (!container) {
      container = document.createElement('div')
      container.className = containerClass
    }
    // Joined: the column lives inside YouTube's navbar, but only while that
    // navbar is the vertical one (our user style) -- inside the stock
    // horizontal bottom bar a vertical block would wreck the layout. Standalone
    // pill on the right edge is the fallback for that and pivot-less pages.
    const verticalEnabled = Boolean(
      ((window as any).NouTube?.getUserStyles?.() as any)?.builtins?.['vertical-navbar']?.enabled,
    )
    const pivot = verticalEnabled ? document.querySelector('ytm-pivot-bar-renderer') : null
    if (pivot) {
      if (container.parentElement !== pivot) {
        pivot.insertBefore(container, pivot.firstChild)
      }
    } else {
      const host = document.body || document.documentElement
      if (container.parentElement !== host) {
        host.appendChild(container)
      }
    }
    ;(container as any).style.cssText = pivot ? inPivotStyle : standaloneStyle
    const flags: NavbarButtonFlags =
      ((window as any).NouTube?.getSettings?.() as any)?.navbarButtons || {}
    // Trusted Types blocks plain innerHTML on youtube.com; replaceChildren and
    // the nouPolicy-wrapped icon strings are the repo's sanctioned pattern.
    container.replaceChildren()
    for (const button of buildNavbarButtons(flags)) {
      if (!button) continue
      const el = document.createElement('div')
      el.style.cssText =
        'display:flex;align-items:center;justify-content:center;width:56px;height:44px;cursor:pointer'
      el.innerHTML = nouPolicy.createHTML(button.icon) as unknown as string
      el.onclick = button.run
      container.appendChild(el)
    }
    if (!pivot) {
      syncFullscreenVisibility(container)
    }
  }

  const syncFullscreenVisibility = (container: HTMLElement) => {
    container.style.display = document.fullscreenElement ? 'none' : 'flex'
  }

  // 'noutube:settings' mirrors noutubeSettingsEvent in content/noutube.ts; kept
  // a literal so this testable module does not pull the whole page bundle in.
  window.addEventListener('noutube:settings', render)
  // 'noutube:user-styles' mirrors noutubeUserStylesEvent in content/noutube.ts:
  // toggling the vertical navbar must re-place the column immediately.
  window.addEventListener('noutube:user-styles', render)
  document.addEventListener('fullscreenchange', render)

  // YouTube's SPA passes can drop foreign nodes; put the column back and keep
  // its fullscreen visibility honest.
  setInterval(() => {
    const container = document.querySelector(`.${containerClass}`) as HTMLElement | null
    if (!container) {
      render()
    } else {
      syncFullscreenVisibility(container)
    }
  }, 2000)

  render()
}
