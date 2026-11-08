import { compareVersions, fetchLatestRelease } from './check-update'
import { version } from '../package.json'

export type FormatOption = {
  formatId: string
  label: string
  description: string
  advanced?: boolean
  // Video-independent descriptor of what the option is, used to match a pinned format
  // against the options of the next video. Absent on the curated options, which have
  // stable format ids of their own.
  kind?: 'video' | 'audio'
  height?: number
  fps?: number
  codec?: string
}

export type UpdateCheckResult =
  | { status: 'not-available' }
  | { status: 'available'; version: string; url?: string }
  | { status: 'error'; message?: string }

export interface MainClient {
  clearData(): Promise<void> | void
  toggleInterception(enabled: boolean): Promise<void> | void
  listFormats(url: string, useCookies: boolean): Promise<{ title: string; formats: FormatOption[] }>
  downloadVideo(url: string, formatId: string, outputDir: string, useCookies: boolean): Promise<void>
  getDownloadsPath(): Promise<string>
  selectFolder(): Promise<string | null>
  openFolder(filePath: string): Promise<void> | void
  openFile(filePath: string): Promise<void> | void
  updateYtDlp(): Promise<void>
  fetchFeed(url: string): Promise<{ ok: boolean; status: number; statusText: string; body: string }>
  setCookie(cookie: string): Promise<void>
  setBlocklist(blocklist: unknown): Promise<void> | void
  setBlockAds(enabled: boolean): Promise<void> | void
  isUpdateSupported(): Promise<boolean>
  checkForUpdate(): Promise<UpdateCheckResult>
  discordLogin(): Promise<{ loggedIn: boolean }>
  discordLogout(): Promise<void> | void
  getDiscordStatus(): Promise<{ loggedIn: boolean }> | { loggedIn: boolean }
}

type NouTubeDownloadClient = {
  listFormats?: MainClient['listFormats']
  downloadVideo?: MainClient['downloadVideo']
  getDownloadsPath?: MainClient['getDownloadsPath']
  openFile?: MainClient['openFile']
  updateYtDlp?: MainClient['updateYtDlp']
  discordLogin?: MainClient['discordLogin']
  discordLogout?: MainClient['discordLogout']
  getDiscordStatus?: MainClient['getDiscordStatus']
}

// ponytail: lazy require keeps bun test from loading expo-modules-core at
// import time; swap for a static import if web/tests ever get an Expo preset.
type LazyModule = typeof import('@/modules/nou-tube-view')
let cachedModule: LazyModule | undefined
function viewModule(): LazyModule {
  if (!cachedModule) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedModule = require('@/modules/nou-tube-view') as LazyModule
  }
  return cachedModule
}

export const mainClient: MainClient = {
  async clearData() {},
  async toggleInterception() {},
  async listFormats(url, useCookies) {
    const nativeModule = viewModule().default as NouTubeDownloadClient
    if (typeof nativeModule.listFormats !== 'function') {
      throw new Error('download API unavailable')
    }
    return nativeModule.listFormats(url, useCookies)
  },
  async downloadVideo(url, formatId, outputDir, useCookies) {
    const nativeModule = viewModule().default as NouTubeDownloadClient
    if (typeof nativeModule.downloadVideo !== 'function') {
      throw new Error('download API unavailable')
    }
    return nativeModule.downloadVideo(url, formatId, outputDir, useCookies)
  },
  async getDownloadsPath() {
    const nativeModule = viewModule().default as NouTubeDownloadClient
    if (typeof nativeModule.getDownloadsPath !== 'function') {
      return ''
    }
    try {
      return await nativeModule.getDownloadsPath()
    } catch {
      return ''
    }
  },
  async selectFolder() {
    return null
  },
  async openFolder() {},
  async openFile(filePath) {
    const nativeModule = viewModule().default as NouTubeDownloadClient
    if (typeof nativeModule.openFile !== 'function') {
      return
    }
    return nativeModule.openFile(filePath)
  },
  async updateYtDlp() {
    const nativeModule = viewModule().default as NouTubeDownloadClient
    if (typeof nativeModule.updateYtDlp !== 'function') {
      return
    }
    return nativeModule.updateYtDlp()
  },
  async fetchFeed(url) {
    // Route through the native module so the request honors the configured proxy;
    // RN's global fetch ignores the WebView ProxyController.
    const mod = viewModule()
    if (typeof (mod.default as { fetchFeed?: unknown }).fetchFeed === 'function') {
      return (mod.default as { fetchFeed: MainClient['fetchFeed'] }).fetchFeed(url)
    }
    const res = await fetch(url)
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      body: await res.text(),
    }
  },
  async setCookie() {},
  async setBlocklist() {},
  async setBlockAds() {},
  async isUpdateSupported() {
    return true
  },
  async checkForUpdate(): Promise<UpdateCheckResult> {
    const result = await fetchLatestRelease(fetch)
    if (result.status === 'error') {
      return result
    }
    if (result.status === 'available' && compareVersions(result.version, version) > 0) {
      return { status: 'available', version: result.version, url: result.url }
    }
    return { status: 'not-available' }
  },
  async discordLogin() {
    const nativeModule = viewModule().default as NouTubeDownloadClient
    if (typeof nativeModule.discordLogin !== 'function') {
      return { loggedIn: false }
    }
    return nativeModule.discordLogin()
  },
  async discordLogout() {
    const nativeModule = viewModule().default as NouTubeDownloadClient
    return nativeModule.discordLogout?.()
  },
  async getDiscordStatus() {
    const nativeModule = viewModule().default as NouTubeDownloadClient
    return nativeModule.getDiscordStatus?.() ?? { loggedIn: false }
  },
}
