import { expect, test } from 'bun:test'
import { mainClient } from './main-client'
import { version } from '../package.json'

const stubFetch = (body: unknown, status = 200) =>
  (() => Promise.resolve(new Response(JSON.stringify(body), { status }))) as unknown as typeof fetch

test('checkForUpdate: rilis lebih baru dari versi app -> available + url', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = stubFetch({ tag_name: 'v99.0.0', html_url: 'u' })
  try {
    expect(await mainClient.checkForUpdate()).toEqual({ status: 'available', version: '99.0.0', url: 'u' })
  } finally {
    globalThis.fetch = orig
  }
})

test('checkForUpdate: versi sama dengan app -> not-available', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = stubFetch({ tag_name: `v${version}`, html_url: 'u' })
  try {
    expect(await mainClient.checkForUpdate()).toEqual({ status: 'not-available' })
  } finally {
    globalThis.fetch = orig
  }
})

test('checkForUpdate: belum ada rilis -> not-available', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = stubFetch({}, 404)
  try {
    expect(await mainClient.checkForUpdate()).toEqual({ status: 'not-available' })
  } finally {
    globalThis.fetch = orig
  }
})

test('checkForUpdate: error jaringan -> error', async () => {
  const orig = globalThis.fetch
  globalThis.fetch = (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch
  try {
    const result = await mainClient.checkForUpdate()
    expect(result.status).toBe('error')
  } finally {
    globalThis.fetch = orig
  }
})

test('isUpdateSupported -> true', async () => {
  expect(await mainClient.isUpdateSupported()).toBe(true)
})
