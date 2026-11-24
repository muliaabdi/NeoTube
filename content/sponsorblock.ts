import { emit, nouStorage } from './utils'

export interface Segment {
  // https://wiki.sponsor.ajay.app/w/Types#Category
  category: string
  actionType: string
  segment: [number, number]
}

export function isSponsorBlockEnabled() {
  const value = nouStorage.getItem('nou:settings')
  if (!value) {
    return false
  }
  try {
    const settings = JSON.parse(value)
    return settings.sponsorBlock
  } catch (e) {
    return false
  }
}

export const DEFAULT_SPONSOR_BLOCK_CATEGORIES = ['sponsor', 'selfpromo', 'interaction']

export function getSponsorBlockCategories(): string[] {
  const value = nouStorage.getItem('nou:settings')
  if (!value) {
    return DEFAULT_SPONSOR_BLOCK_CATEGORIES
  }
  try {
    const settings = JSON.parse(value)
    // An explicit empty selection stands: the user turned every category off.
    return Array.isArray(settings.sponsorBlockCategories)
      ? settings.sponsorBlockCategories
      : DEFAULT_SPONSOR_BLOCK_CATEGORIES
  } catch (e) {
    return DEFAULT_SPONSOR_BLOCK_CATEGORIES
  }
}

// https://wiki.sponsor.ajay.app/w/Types#Category
const categoryColors: Record<string, string> = {
  sponsor: '#00d400',
  selfpromo: '#ffff00',
  interaction: '#cc00ff',
  intro: '#00ffff',
  outro: '#0202ed',
  preview: '#008fd6',
  music_offtopic: '#ff9900',
  poi_highlight: '#ff1684',
  filler: '#7300ff',
}

const categoryLabels: Record<string, string> = {
  sponsor: 'Sponsor',
  selfpromo: 'Self-Promo',
  interaction: 'Interaction',
  intro: 'Intro',
  outro: 'Outro',
  preview: 'Preview',
  music_offtopic: 'Music: Non-Music',
  poi_highlight: 'Highlight',
  filler: 'Filler',
}

export function formatSegmentTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function getCategoryLabel(category: string): string {
  return categoryLabels[category] || category
}

const overlayClass = '_nou_sb_segments'
const segmentClass = '_nou_sb_segment'
const panelId = '_nou_sb_panel'

// The bar that spans the whole duration: new mobile layout, then desktop, then the older mobile one.
const progressBarSelectors = [
  '.ytChapteredProgressBarHost',
  '.ytProgressBarLineProgressBarLine',
  '.ytProgressBarLineHost',
  '.ytPlayerProgressBarHost',
  '.ytp-progress-list',
  '.progress-bar-line',
  '.progress-bar-background',
]
// Chaptered videos split the bar into per-chapter blocks separated by gaps, so a
// segment has to be drawn piecewise to stay aligned with the time it covers.
const chapterSelectors = ['.ytChapteredProgressBarChapteredPlayerBarChapter', '.ytp-chapter-hover-container']

interface Chapter {
  start: number
  end: number
  left: number
  width: number
}

function getProgressBars() {
  const bars: HTMLElement[] = []
  for (const selector of progressBarSelectors) {
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.offsetWidth > 0 && !bars.some((b) => b.contains(el) || el.contains(b))) {
        bars.push(el)
      }
    }
  }
  return bars
}

function getChapters(bar: HTMLElement): Chapter[] {
  let elements: HTMLElement[] = []
  for (const selector of chapterSelectors) {
    elements = Array.from(bar.querySelectorAll<HTMLElement>(selector))
    if (elements.length) {
      break
    }
  }

  if (!elements.length) {
    return [{ start: 0, end: 1, left: 0, width: bar.offsetWidth }]
  }

  // Gaps between chapters make the rendered widths slightly narrower than the
  // time they represent, so take the time span from the inline percentage when
  // YouTube provides it and fall back to the width proportion otherwise.
  const totalWidth = elements.reduce((sum, el) => sum + el.offsetWidth, 0)
  const chapters: Chapter[] = []
  let start = 0
  for (const el of elements) {
    const percent = parseFloat(el.style.width)
    const span = el.style.width.endsWith('%') && Number.isFinite(percent) ? percent / 100 : el.offsetWidth / (totalWidth || 1)
    chapters.push({ start, end: start + span, left: el.offsetLeft, width: el.offsetWidth })
    start += span
  }
  // Absorb rounding drift so the last chapter always reaches the end.
  chapters[chapters.length - 1].end = 1
  return chapters
}

export function clearSkipSegments() {
  for (const el of document.querySelectorAll(`.${overlayClass}`)) {
    ;(el.parentElement as HTMLElement | null)?.removeAttribute('data-nou-sb')
    el.remove()
  }
  document.getElementById(panelId)?.remove()
}

function seekToTime(seconds: number) {
  const player = document.getElementById('movie_player') as any
  if (typeof player?.seekTo === 'function') {
    player.seekTo(seconds, true)
    return
  }
  const video = document.querySelector('video')
  if (video) {
    video.currentTime = seconds
  }
}

function renderSegmentsPanel(videoId: string, segments: Segment[], segmentKey: string) {
  const visibleSegments = segments
    .filter((s) => s.actionType !== 'full')
    .slice()
    .sort((a, b) => a.segment[0] - b.segment[0])

  if (!visibleSegments.length) {
    document.getElementById(panelId)?.remove()
    return
  }

  const anchor =
    document.querySelector('ytm-slim-video-metadata-section-renderer') ||
    document.querySelector('ytd-watch-metadata') ||
    document.querySelector('#above-the-fold')
  if (!anchor?.parentElement) {
    return
  }

  const key = `${videoId}:${segmentKey}`
  let panel = document.getElementById(panelId) as HTMLElement | null
  if (panel && panel.dataset.nouSbPanel === key && panel.previousElementSibling === anchor) {
    return
  }

  const wasExpanded = panel?.dataset.expanded === 'true' && panel.dataset.videoId === videoId
  panel?.remove()

  panel = document.createElement('div')
  panel.id = panelId
  panel.dataset.nouSbPanel = key
  panel.dataset.videoId = videoId
  panel.dataset.expanded = wasExpanded ? 'true' : 'false'

  const header = document.createElement('button')
  header.type = 'button'
  header.className = '_nou_sb_header'

  const left = document.createElement('span')
  left.className = '_nou_sb_header_left'

  const title = document.createElement('span')
  title.className = '_nou_sb_title'
  title.textContent = `SponsorBlock (${visibleSegments.length})`
  left.append(title)

  const dots = document.createElement('span')
  dots.className = '_nou_sb_dots'
  const seenCategories = new Set<string>()
  for (const seg of visibleSegments) {
    if (seenCategories.has(seg.category)) continue
    seenCategories.add(seg.category)
    const dot = document.createElement('span')
    dot.className = '_nou_sb_dot'
    dot.style.background = categoryColors[seg.category] || categoryColors.sponsor
    dots.append(dot)
  }
  left.append(dots)

  const chevron = document.createElement('span')
  chevron.className = '_nou_sb_chevron'
  chevron.textContent = wasExpanded ? '▾' : '▸'

  header.append(left, chevron)

  const list = document.createElement('div')
  list.className = '_nou_sb_list'
  list.style.display = wasExpanded ? 'flex' : 'none'

  for (const seg of visibleSegments) {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = '_nou_sb_row'
    row.onclick = () => seekToTime(seg.segment[0])

    const rowLeft = document.createElement('span')
    rowLeft.className = '_nou_sb_row_left'

    const dot = document.createElement('span')
    dot.className = '_nou_sb_dot'
    dot.style.background = categoryColors[seg.category] || categoryColors.sponsor

    const label = document.createElement('span')
    label.className = '_nou_sb_row_label'
    label.textContent = getCategoryLabel(seg.category)

    rowLeft.append(dot, label)

    const time = document.createElement('span')
    time.className = '_nou_sb_row_time'
    const startText = formatSegmentTime(seg.segment[0])
    const endText = formatSegmentTime(seg.segment[1])
    time.textContent = seg.segment[0] === seg.segment[1] ? startText : `${startText} – ${endText}`

    row.append(rowLeft, time)
    list.append(row)
  }

  header.onclick = () => {
    const next = panel!.dataset.expanded !== 'true'
    panel!.dataset.expanded = next ? 'true' : 'false'
    list.style.display = next ? 'flex' : 'none'
    chevron.textContent = next ? '▾' : '▸'
  }

  panel.append(header, list)
  anchor.insertAdjacentElement('afterend', panel)
}

export function renderSkipSegments(videoId: string, segments: Segment[], duration: number) {
  if (!videoId) {
    return
  }

  const segmentKey = segments
    .map(({ actionType, category, segment }) => `${actionType}:${category}:${segment[0]}:${segment[1]}`)
    .join(',')

  renderSegmentsPanel(videoId, segments, segmentKey)

  if (!duration || !Number.isFinite(duration)) {
    return
  }

  const bars = getProgressBars()
  if (segments.length > 0) {
    emit('log', `[sponsorblock] found ${segments.length} segments for ${videoId}, progress bars found: ${bars.length}`)
  }

  for (const bar of bars) {
    const overlay = bar.querySelector<HTMLElement>(`.${overlayClass}`)
    const chapters = getChapters(bar)
    const chapterKey = chapters
      .map(({ start, end, left, width }) => `${start}:${end}:${left}:${width}`)
      .join(',')
    const key = `${videoId}:${duration}:${segmentKey}:${bar.offsetWidth}:${chapterKey}`
    // YouTube re-renders and resizes its controls, so redraw whenever the
    // overlay went away or its segments/chapter geometry changed.
    if (overlay && bar.dataset.nouSb === key) {
      continue
    }
    overlay?.remove()
    // Chapter offsets are measured against the bar, so it has to be the offset parent.
    if (getComputedStyle(bar).position == 'static') {
      bar.style.position = 'relative'
    }
    bar.append(buildOverlay(segments, duration, chapters))
    bar.dataset.nouSb = key
  }
}

function buildOverlay(segments: Segment[], duration: number, chapters: Chapter[]) {
  const overlay = document.createElement('div')
  overlay.className = overlayClass

  for (const segment of segments) {
    // A `full` segment covers the entire video, so there is nothing to point at.
    if (segment.actionType == 'full') {
      continue
    }
    const background = categoryColors[segment.category] || categoryColors.sponsor
    const start = Math.max(0, Math.min(1, segment.segment[0] / duration))
    const end = Math.max(start, Math.min(1, segment.segment[1] / duration))

    for (const chapter of chapters) {
      const from = Math.max(start, chapter.start)
      const to = Math.min(end, chapter.end)
      // Zero-length categories such as poi_highlight still get a marker.
      if (start == end ? to < from : to <= from) {
        continue
      }
      const span = chapter.end - chapter.start
      if (span <= 0) {
        continue
      }
      // Accumulated chapter spans drift by a rounding error, which would leave a
      // sliver of a segment in the chapter next to the one it really ends in.
      const width = ((to - from) / span) * chapter.width
      if (start != end && width < 0.5) {
        continue
      }
      const el = document.createElement('div')
      el.className = segmentClass
      el.style.left = `${chapter.left + ((from - chapter.start) / span) * chapter.width}px`
      el.style.width = `${Math.max(start == end ? 2 : 1, width)}px`
      el.style.background = background
      overlay.append(el)
    }
  }

  return overlay
}

export async function getSkipSegments(videoId: string, categories: string[]) {
  if (!categories.length) {
    return { videoId, segments: [] as Segment[] }
  }
  const params = new URLSearchParams({
    videoID: videoId,
    categories: JSON.stringify(categories),
  })
  const url = `https://sponsor.ajay.app/api/skipSegments?${params}`
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url)
      let segments: Segment[] = []
      if (res.status == 200) {
        segments = (await res.json()) as Segment[]
      }
      return { videoId, segments }
    } catch {
      // Transient WebView network errors can happen on initial page load.
    }
  }
  return {
    videoId,
    segments: [] as Segment[],
  }
}
