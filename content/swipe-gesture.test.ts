import { describe, expect, it } from 'bun:test'
import { isSwipeDownToMini } from './swipe-gesture'

describe('isSwipeDownToMini', () => {
  it('detects a clear vertical swipe down from near the top/player area', () => {
    // dy = 80px down, dx = 10px horizontal jitter, started at y = 100
    expect(isSwipeDownToMini({ startY: 100, deltaX: 10, deltaY: 80, timeMs: 250 })).toBe(true)
  })

  it('rejects upward swipes', () => {
    expect(isSwipeDownToMini({ startY: 200, deltaX: 5, deltaY: -80, timeMs: 200 })).toBe(false)
  })

  it('rejects horizontal swipes (e.g. seeking or gestures)', () => {
    // dx = 100, dy = 30
    expect(isSwipeDownToMini({ startY: 100, deltaX: 100, deltaY: 30, timeMs: 200 })).toBe(false)
  })

  it('rejects small jitter/taps that do not meet minimum threshold', () => {
    expect(isSwipeDownToMini({ startY: 100, deltaX: 2, deltaY: 20, timeMs: 150 })).toBe(false)
  })

  it('rejects swipes that start too far down in comments/description', () => {
    // window height typically > 600, player is in top 40%
    expect(isSwipeDownToMini({ startY: 650, deltaX: 5, deltaY: 100, timeMs: 250, maxStartY: 450 })).toBe(false)
  })
})
