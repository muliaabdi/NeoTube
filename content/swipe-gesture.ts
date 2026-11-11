export interface SwipeParams {
  startY: number
  deltaX: number
  deltaY: number
  timeMs: number
  maxStartY?: number
}

export interface RectBounds {
  left: number
  right: number
  top: number
  bottom: number
  width: number
  height: number
}

export function isPointInsideRect(x: number, y: number, rect: RectBounds | null | undefined): boolean {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
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
