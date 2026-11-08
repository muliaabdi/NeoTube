import { describe, expect, test } from 'bun:test'
import { buildNavbarButtons } from './navbar'

describe('buildNavbarButtons', () => {
  test('settings always present, flags filter the rest', () => {
    const list = buildNavbarButtons({ back: false, forward: false, reload: true, home: false, history: false, library: false, star: false })
    expect(list.filter(Boolean).map((b) => b!.id)).toEqual(['reload', 'settings'])
  })

  test('full flags keep the pinned order', () => {
    const list = buildNavbarButtons({ back: true, forward: true, reload: true, home: true, history: true, library: true, star: true })
    expect(list.filter(Boolean).map((b) => b!.id)).toEqual([
      'back',
      'forward',
      'reload',
      'home',
      'history',
      'library',
      'star',
      'settings',
    ])
  })
})
