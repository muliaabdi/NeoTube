export const RELEASES_LATEST_URL = 'https://api.github.com/repos/muliaabdi/NeoTube/releases/latest'

export type LatestReleaseResult =
  | { status: 'not-available' }
  | { status: 'available'; version: string; url: string }
  | { status: 'error'; message?: string }

const baseSegments = (value: string) =>
  value
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((segment) => Number.parseInt(segment, 10) || 0)

const isPrerelease = (value: string) => value.trim().replace(/^v/i, '').includes('-')

/**
 * Semver-ish compare: numeric segments, missing segment = 0, prerelease suffix
 * loses to the plain release. Positive when `a` is newer.
 */
export const compareVersions = (a: string, b: string): number => {
  const A = baseSegments(a)
  const B = baseSegments(b)
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const diff = (A[i] ?? 0) - (B[i] ?? 0)
    if (diff !== 0) return diff
  }
  if (isPrerelease(a)) return isPrerelease(b) ? 0 : -1
  return isPrerelease(b) ? 1 : 0
}

export const isUpdateAvailable = (availableVersion: string | null, currentVersion: string) =>
  availableVersion !== null && compareVersions(availableVersion, currentVersion) > 0

export const fetchLatestRelease = async (fetchFn: typeof fetch): Promise<LatestReleaseResult> => {
  try {
    const res = await fetchFn(RELEASES_LATEST_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (res.status === 404) {
      // No published release yet.
      return { status: 'not-available' }
    }
    if (!res.ok) {
      return { status: 'error', message: `HTTP ${res.status}` }
    }
    const data = (await res.json()) as { tag_name?: unknown; html_url?: unknown }
    if (typeof data?.tag_name !== 'string' || !data.tag_name) {
      return { status: 'error', message: 'missing tag_name' }
    }
    return {
      status: 'available',
      version: data.tag_name.replace(/^v/, ''),
      url: typeof data?.html_url === 'string' && data.html_url ? data.html_url : RELEASES_LATEST_URL,
    }
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) }
  }
}
