import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { compareVersions, fetchLatestRelease } from '@/lib/check-update'

const THROTTLE_MS = 24 * 3600 * 1000

export const update$ = observable({
  availableVersion: null as string | null,
  releaseUrl: null as string | null,
  checkedAt: 0,
})

syncObservable(update$, {
  persist: {
    name: 'update',
    plugin: ObservablePersistMMKV,
  },
})

export const shouldCheck = (checkedAt: number, now: number) =>
  checkedAt === 0 || now - checkedAt > THROTTLE_MS

/**
 * Startup check: throttled to once a day. A failed fetch keeps the previous
 * state and leaves checkedAt alone so the next launch retries.
 */
export const runUpdateCheck = async (currentVersion: string) => {
  if (!shouldCheck(update$.checkedAt.get(), Date.now())) {
    return
  }
  const result = await fetchLatestRelease(fetch)
  if (result.status === 'error') {
    console.error('update check failed', result.message)
    return
  }
  update$.checkedAt.set(Date.now())
  if (result.status === 'available' && compareVersions(result.version, currentVersion) > 0) {
    update$.availableVersion.set(result.version)
    update$.releaseUrl.set(result.url)
  } else {
    update$.availableVersion.set(null)
    update$.releaseUrl.set(null)
  }
}
