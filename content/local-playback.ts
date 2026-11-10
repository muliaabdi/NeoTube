import { emit, nouPolicy, nouStorage, parseJson } from './utils'

/*
 * Local playback: when a /watch page has a downloaded copy, this overlay
 * replaces the YouTube player with a <video> fed from the virtual origin
 * (https://noutube-assets.local, served by the app shells). YouTube's own
 * player stays paused and muted behind it for the whole time -- history and
 * progress on YouTube's side are deliberately not tracked
 * (see docs/superpowers/specs/2026-11-10-local-playback-design.md).
 */

const CONTAINER_ID = '_nou_local_overlay'
const VIDEO_CLASS = '_nou_local_player'
const DOWNLOADS_KEY = 'nou:downloads'
const SETTINGS_KEY = 'nou:settings'
// The resume position round trip gets one chance; past this the video just
// starts from the top rather than sitting on a black screen.
const POSITION_TIMEOUT_MS = 500

type Downloads = Record<string, { audioOnly?: boolean } | undefined>

export function getLocalVideoUrl(videoId: string): string {
  return `https://noutube-assets.local/downloads/${encodeURIComponent(videoId)}`
}

export function videoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://m.youtube.com')
    if (parsed.pathname !== '/watch') {
      return null
    }
    const videoId = parsed.searchParams.get('v')
    return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null
  } catch {
    return null
  }
}

export function shouldTriggerLocalPlayback(
  pathname: string,
  videoId: string,
  downloads: Downloads,
  settingEnabled: boolean,
): boolean {
  return pathname === '/watch' && settingEnabled && Boolean(downloads[videoId] && !downloads[videoId]!.audioOnly)
}

/* --- overlay --- */

let activeVideoId: string | null = null
let pendingPosition: ((seconds: number) => void) | null = null

const overlayVideo = () => document.querySelector<HTMLVideoElement>('video.' + VIDEO_CLASS)
const youtubeVideo = () => {
  for (const video of Array.from(document.querySelectorAll('video'))) {
    if (!video.classList.contains(VIDEO_CLASS)) {
      return video
    }
  }
  return null
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const whole = Math.floor(seconds)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? h + ':' : ''}${mm}:${String(s).padStart(2, '0')}`
}

// Called by the app (Task 6) with the watch-history position, answering the
// emit('local-playback-start') round trip.
function setLocalPosition(videoId: string, seconds: number) {
  if (pendingPosition && videoId === activeVideoId) {
    pendingPosition(Math.max(0, Number(seconds) || 0))
  }
}

// YouTube resumes on its own (autoplay, a queued next video, a stray script);
// while the overlay is up the page's videos stay paused and silent.
function lockPlayGuard(event: Event) {
  const target = event.target
  if (target instanceof HTMLVideoElement && !target.classList.contains(VIDEO_CLASS)) {
    target.pause()
    target.muted = true
  }
}

function restoreYoutubePlayer(play: boolean) {
  const video = youtubeVideo()
  if (!video) return
  video.muted = false
  if (play) {
    video.play().catch(() => undefined)
  }
}

function buildOverlay(videoId: string): HTMLElement {
  const container = document.createElement('div')
  container.id = CONTAINER_ID
  container.innerHTML = nouPolicy.createHTML(/* HTML */ `
    <video class="${VIDEO_CLASS}" playsinline autoplay></video>
    <div class="_nou_lp_replay">
      <button type="button" data-nou-action="replay" aria-label="Replay">↻</button>
    </div>
    <div class="_nou_lp_bar">
      <button type="button" data-nou-action="toggle" aria-label="Play or pause">⏸</button>
      <span class="_nou_lp_time">0:00 / 0:00</span>
      <input class="_nou_lp_seek" data-nou-action="seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Seek" />
      <button type="button" data-nou-action="speed" aria-label="Playback speed">1×</button>
      <button type="button" data-nou-action="youtube" aria-label="Watch on YouTube">YouTube</button>
    </div>
    <style>
      #${CONTAINER_ID} {
        position: absolute;
        inset: 0;
        z-index: 2147483646;
        background: #000;
        display: flex;
      }
      #${CONTAINER_ID} video { width: 100%; height: 100%; object-fit: contain; }
      #${CONTAINER_ID} ._nou_lp_bar {
        position: absolute;
        left: 0; right: 0; bottom: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px 10px;
        background: linear-gradient(transparent, rgba(0,0,0,.8));
        color: #fff;
        font: 13px/1 Roboto, Arial, sans-serif;
      }
      #${CONTAINER_ID} button {
        background: none; border: 0; color: #fff;
        font: 600 13px/1 Roboto, Arial, sans-serif;
        padding: 8px; cursor: pointer;
      }
      #${CONTAINER_ID} ._nou_lp_seek { flex: 1; accent-color: #f00; min-width: 0; }
      #${CONTAINER_ID} ._nou_lp_time { font-variant-numeric: tabular-nums; white-space: nowrap; }
      #${CONTAINER_ID} ._nou_lp_replay {
        position: absolute; inset: 0;
        display: none;
        align-items: center; justify-content: center;
      }
      #${CONTAINER_ID} ._nou_lp_replay button {
        font-size: 44px; width: 84px; height: 84px; border-radius: 50%;
        background: rgba(0,0,0,.6);
      }
      #${CONTAINER_ID}._nou_lp_ended ._nou_lp_replay { display: flex; }
      #${CONTAINER_ID}._nou_lp_ended video { opacity: .35; }
      #${CONTAINER_ID}._nou_lp_hidden ._nou_lp_bar { display: none; }
    </style>
  `
  )
  return container
}

function unmountLocalOverlay(fallbackToYoutube = false) {
  if (!activeVideoId) return
  activeVideoId = null
  pendingPosition = null
  document.removeEventListener('play', lockPlayGuard, true)
  document.getElementById(CONTAINER_ID)?.remove()
  if (fallbackToYoutube) {
    restoreYoutubePlayer(true)
  }
}

function mountLocalOverlay(videoId: string) {
  // The downloads sync and navigation checks both rerun on the same page;
  // rebuilding would restart the video mid-play.
  if (activeVideoId === videoId) return
  unmountLocalOverlay(false)
  const player = document.querySelector<HTMLElement>('#movie_player')
  if (!player) return

  const container = buildOverlay(videoId)
  const video = container.querySelector('video')!
  const bar = container.querySelector('._nou_lp_bar') as HTMLElement
  const timeLabel = container.querySelector('._nou_lp_time')!
  const seek = container.querySelector<HTMLInputElement>('._nou_lp_seek')!
  const toggle = container.querySelector<HTMLButtonElement>('[data-nou-action="toggle"]')!
  const speed = container.querySelector<HTMLButtonElement>('[data-nou-action="speed"]')!
  const speeds = [1, 1.25, 1.5, 2]

  let seeking = false
  let lastProgressEmit = 0
  const renderTime = () => {
    timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`
    if (!seeking) {
      seek.value = String(video.duration ? (video.currentTime / video.duration) * 1000 : 0)
    }
    // Record into the app's internal watch history (states/history.ts). Throttle
    // to every 2s so the store is not thrashed with every animation frame.
    const now = Date.now()
    if (now - lastProgressEmit > 2000 && video.duration) {
      lastProgressEmit = now
      emit('progress', {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        current: Math.floor(video.currentTime),
        duration: Math.floor(video.duration),
        title: document.title,
      })
    }
  }

  // The file is gone (deleted, renamed, another device's index): fall back to
  // streaming rather than showing a black box.
  video.addEventListener('error', () => unmountLocalOverlay(true))
  video.addEventListener('loadedmetadata', () => {
    if (video.duration) seek.max = '1000'
    renderTime()
  })
  video.addEventListener('timeupdate', renderTime)
  video.addEventListener('ended', () => container.classList.add('_nou_lp_ended'))
  video.addEventListener('play', () => {
    container.classList.remove('_nou_lp_ended')
    toggle.textContent = '⏸'
  })
  video.addEventListener('pause', () => (toggle.textContent = '▶'))
  video.src = getLocalVideoUrl(videoId)
  video.play().catch(() => undefined)

  container.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('button')
    const action = button?.dataset.nouAction
    if (action === 'toggle') {
      if (video.paused) video.play().catch(() => undefined)
      else video.pause()
    } else if (action === 'replay') {
      video.currentTime = 0
      video.play().catch(() => undefined)
    } else if (action === 'speed') {
      const next = speeds[(speeds.indexOf(video.playbackRate) + 1) % speeds.length]
      video.playbackRate = next
      speed.textContent = `${next}×`
    } else if (action === 'youtube') {
      // Explicitly hand control back to the YouTube player.
      unmountLocalOverlay(true)
      return
    } else if (event.target === video) {
      if (video.paused) video.play().catch(() => undefined)
      else video.pause()
    }
    bar.classList.remove('_nou_lp_hidden')
  })
  seek.addEventListener('input', () => {
    seeking = true
    timeLabel.textContent = `${formatTime((Number(seek.value) / 1000) * video.duration)} / ${formatTime(video.duration)}`
  })
  seek.addEventListener('change', () => {
    seeking = false
    if (video.duration) video.currentTime = (Number(seek.value) / 1000) * video.duration
  })
  // Tap the video to toggle the bar (mobile), mouse move to reveal (desktop).
  video.addEventListener('click', () => bar.classList.remove('_nou_lp_hidden'))
  let hideTimer = 0
  container.addEventListener('pointermove', () => {
    bar.classList.remove('_nou_lp_hidden')
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => bar.classList.add('_nou_lp_hidden'), 2500)
  })

  // The YouTube player behind the overlay stays paused and muted from the
  // first frame; the guard keeps it that way until unmount.
  const yt = youtubeVideo()
  if (yt) {
    yt.pause()
    yt.muted = true
  }
  document.addEventListener('play', lockPlayGuard, true)

  player.appendChild(container)
  activeVideoId = videoId

  // Resume position: ask the app, which answers through
  // window.NouTube.setLocalPosition (Task 6).
  const position = new Promise<number>((resolve) => {
    pendingPosition = resolve
    emit('local-playback-start', { videoId })
    window.setTimeout(() => resolve(0), POSITION_TIMEOUT_MS)
  })
  void position.then((seconds) => {
    pendingPosition = null
    if (activeVideoId === videoId && seconds > 0 && seconds < (video.duration || Infinity)) {
      video.currentTime = seconds
    }
  })
}

/* --- installation --- */

function checkLocalPlayback() {
  const videoId = videoIdFromUrl(location.pathname + location.search)
  const downloads = parseJson(nouStorage.getItem(DOWNLOADS_KEY), {}) as Downloads
  const settings = parseJson(nouStorage.getItem(SETTINGS_KEY), {}) as { localPlayback?: boolean }
  const enabled = settings.localPlayback !== false
  if (videoId && shouldTriggerLocalPlayback(location.pathname, videoId, downloads, enabled)) {
    mountLocalOverlay(videoId)
  } else {
    unmountLocalOverlay(false)
  }
}

export function installLocalPlayback() {
  ;(window.NouTube as any).setLocalPosition = setLocalPosition
  // The overlay has to survive YouTube's own SPA redraws of #movie_player's
  // children, so the check reruns on every navigation rather than mounting
  // once; mountLocalOverlay itself is idempotent-ish (it rebuilds on change).
  for (const type of ['yt-navigate-finish', 'popstate', 'noutube:downloads']) {
    window.addEventListener(type, () => window.setTimeout(checkLocalPlayback, 0))
  }
  const start = () => checkLocalPlayback()
  if (document.documentElement) {
    start()
  } else {
    document.addEventListener('DOMContentLoaded', start, { once: true })
  }
}
