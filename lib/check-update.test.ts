import { expect, test } from 'bun:test'
import { compareVersions, fetchLatestRelease, RELEASES_LATEST_URL } from './check-update'

test('compareVersions: tag dengan v lebih tinggi dari versi lama', () => {
  expect(compareVersions('v1.0.0', '0.7.6') > 0).toBe(true)
})

test('compareVersions: v prefix diabaikan', () => {
  expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0)
})

test('compareVersions: versi lama lebih rendah', () => {
  expect(compareVersions('0.7.6', '1.0.0') < 0).toBe(true)
})

test('compareVersions: prerelease lebih rendah dari rilis', () => {
  expect(compareVersions('1.0.0-rc1', '1.0.0') < 0).toBe(true)
})

test('compareVersions: segmen hilang = 0', () => {
  expect(compareVersions('1.2', '1.2.0')).toBe(0)
})

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const fetchLike = (fn: () => Promise<Response>) => fn as unknown as typeof fetch

test('fetchLatestRelease: 200 -> available dengan versi tanpa v dan url', async () => {
  const result = await fetchLatestRelease(fetchLike(() =>
    Promise.resolve(jsonResponse({ tag_name: 'v1.0.0', html_url: 'u' }))),
  )
  expect(result).toEqual({ status: 'available', version: '1.0.0', url: 'u' })
})

test('fetchLatestRelease: 404 -> not-available', async () => {
  const result = await fetchLatestRelease(fetchLike(() => Promise.resolve(new Response('', { status: 404 }))))
  expect(result).toEqual({ status: 'not-available' })
})

test('fetchLatestRelease: 500 -> error', async () => {
  const result = await fetchLatestRelease(fetchLike(() => Promise.resolve(new Response('', { status: 500 }))))
  expect(result.status).toBe('error')
})

test('fetchLatestRelease: fetch throw -> error', async () => {
  const result = await fetchLatestRelease(fetchLike(() => Promise.reject(new Error('offline'))))
  expect(result.status).toBe('error')
})

test('RELEASES_LATEST_URL menunjuk repo yang benar', () => {
  expect(RELEASES_LATEST_URL).toBe('https://api.github.com/repos/muliaabdi/NeoTube/releases/latest')
})
