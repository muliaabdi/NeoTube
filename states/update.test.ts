import { beforeEach, expect, test } from 'bun:test'
import { runUpdateCheck, shouldCheck, update$ } from './update'

const HOUR = 3600_000

beforeEach(() => {
  update$.availableVersion.set(null)
  update$.releaseUrl.set(null)
  update$.checkedAt.set(0)
})

const stubFetch = (body: unknown, status = 200, counter = { calls: 0 }) =>
  (() => {
    counter.calls++
    return Promise.resolve(new Response(JSON.stringify(body), { status }))
  }) as unknown as typeof fetch

test('shouldCheck: belum pernah dicek -> true', () => {
  expect(shouldCheck(0, 1)).toBe(true)
})

test('shouldCheck: dalam 24 jam -> false', () => {
  expect(shouldCheck(1000, 1000 + 23 * HOUR)).toBe(false)
})

test('shouldCheck: lewat 24 jam -> true', () => {
  expect(shouldCheck(1000, 1000 + 25 * HOUR)).toBe(true)
})

test('runUpdateCheck: rilis lebih baru -> state terisi', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = stubFetch({ tag_name: 'v1.0.0', html_url: 'u' })
  try {
    await runUpdateCheck('0.7.6')
    expect(update$.availableVersion.get()).toBe('1.0.0')
    expect(update$.releaseUrl.get()).toBe('u')
    expect(update$.checkedAt.get() > 0).toBe(true)
  } finally {
    globalThis.fetch = orig
  }
})

test('runUpdateCheck: versi sama -> availableVersion dibersihkan', async () => {
  update$.availableVersion.set('0.9.9')
  const orig = globalThis.fetch
  globalThis.fetch = stubFetch({ tag_name: 'v0.7.6', html_url: 'u' })
  try {
    await runUpdateCheck('0.7.6')
    expect(update$.availableVersion.get()).toBe(null)
    expect(update$.checkedAt.get() > 0).toBe(true)
  } finally {
    globalThis.fetch = orig
  }
})

test('runUpdateCheck: belum ada rilis (404) -> null, checkedAt maju', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = stubFetch({}, 404)
  try {
    await runUpdateCheck('0.7.6')
    expect(update$.availableVersion.get()).toBe(null)
    expect(update$.checkedAt.get() > 0).toBe(true)
  } finally {
    globalThis.fetch = orig
  }
})

test('runUpdateCheck: dalam throttle -> tidak fetch', async () => {
  const counter = { calls: 0 }
  update$.checkedAt.set(Date.now())
  const orig = globalThis.fetch
  globalThis.fetch = stubFetch({ tag_name: 'v9.0.0', html_url: 'u' }, 200, counter)
  try {
    await runUpdateCheck('0.7.6')
    expect(counter.calls).toBe(0)
    expect(update$.availableVersion.get()).toBe(null)
  } finally {
    globalThis.fetch = orig
  }
})

test('runUpdateCheck: error jaringan -> state lama dipertahankan, checkedAt tak maju', async () => {
  update$.availableVersion.set('0.9.9')
  update$.checkedAt.set(123)
  const orig = globalThis.fetch
  globalThis.fetch = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch
  try {
    await runUpdateCheck('0.7.6')
    expect(update$.availableVersion.get()).toBe('0.9.9')
    expect(update$.checkedAt.get()).toBe(123)
  } finally {
    globalThis.fetch = orig
  }
})
