export interface SwipeParams {
  startY: number
  deltaX: number
  deltaY: number
  timeMs: number
  maxStartY?: number
}

/**
 * Recognizes a downward swipe gesture meant to minimize the video player
 * into a miniplayer, similar to ProTube / NewPipe / YouTube mobile app.
 */
export function isSwipeDownToMini(params: SwipeParams): boolean {
  const { startY, deltaX, deltaY, timeMs, maxStartY } = params

  // Must not take too long (flick/swipe, not a slow drag)
  if (timeMs > 800) return false

  // If maxStartY is specified, start must be above it
  if (typeof maxStartY === 'number' && startY > maxStartY) return false

  // Must be downward movement of at least 35px
  if (deltaY < 35) return false

  // Vertical movement must dominate horizontal movement
  if (Math.abs(deltaY) < Math.abs(deltaX) * 1.2) return false

  return true
}
