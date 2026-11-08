import { describe, expect, it } from 'bun:test'
import { withContentCountry } from './content-country'

describe('withContentCountry', () => {
  it('appends gl to a bare url', () => {
    expect(withContentCountry('https://m.youtube.com', 'ID')).toBe('https://m.youtube.com/?gl=ID')
  })

  it('replaces an existing gl instead of duplicating it', () => {
    expect(withContentCountry('https://m.youtube.com/?gl=US', 'ID')).toBe('https://m.youtube.com/?gl=ID')
  })

  it('keeps other params when replacing gl', () => {
    expect(withContentCountry('https://m.youtube.com/watch?v=x&gl=US', 'ID')).toBe(
      'https://m.youtube.com/watch?v=x&gl=ID',
    )
  })

  it('passes the url through without a valid country', () => {
    expect(withContentCountry('https://m.youtube.com', null)).toBe('https://m.youtube.com')
    expect(withContentCountry('https://m.youtube.com', 'xyz')).toBe('https://m.youtube.com')
  })
})
