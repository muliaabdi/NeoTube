# Navbar Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pindahkan tombol-tombol toolbar (Settings, Back/Forward/Reload/Home, History, Library, Star) ke kolom yang disuntikkan ke halaman YouTube di atas navbar vertikal.

**Architecture:** Flag tombol (toggle Settings lama `showXButtonInHeader`) dikemas app ke snapshot content-settings (`navbarButtons`), content script `content/navbar.ts` menyuntik kolom tombol DOM dan merespons event settings; aksi modal di-bridge via `emit('navbar-action', ...)`.

**Tech Stack:** React Native (expo), content script TS dibundel `bun build content/main.ts`, i18next, bun test.

**Spec:** `docs/superpowers/specs/2026-11-08-navbar-buttons-design.md`

## Global Constraints

- Tidak ada key setting baru; reuse `showBackButtonInHeader`, `showForwardButtonInHeader`, `showReloadButtonInHeader`, `showHomeButtonInHeader`, `showHistoryButtonInHeader`, `showLibraryButtonInHeader`, `showStarButtonInHeader`.
- Tombol Settings di kolom selalu tampil (tanpa flag).
- Kolom hanya di native (guard `!window.electron` di `content/main.ts`), desktop web tidak berubah.
- Style kolom meniru `vertical-navbar` builtin (rgba(18,18,18,.9), blur 8px, radius 20px kiri, border 1px rgba(255,255,255,.08)).
- Semua teks UI via i18n (en + id saja; locale lain fallback en).

## Review Focus

1. YouTube SPA merombak DOM dan menghapus node suntikan -> observer memasang ulang (Task 2 test guard pure-fn + verifikasi visual).
2. Toggle Settings saat app jalan harus mengubah kolom tanpa reload -> `noutubeSettingsEvent` listener (Task 2).
3. Star di halaman tanpa video (home/ads) -> `getVideoUrl()` kosong -> no-op, jangan emit `star` url kosong (Task 2 step guard).
4. Fullscreen player: kolom harus ikut hilang (`document.fullscreenElement` check) (Task 2).
5. Desktop tidak dapat kolom -> guard `!window.electron` (Task 2 step install).

---

### Task 1: App — snapshot `navbarButtons` + handler `navbar-action`

**Files:**
- Create: `lib/content-settings.ts`
- Modify: `components/page/MainPageContent.tsx` (hapus `getContentSettingsSnapshot` lokal, import dari lib; tambah case `navbar-action` di `onMessage`)
- Test: `lib/content-settings.test.ts`

**Interfaces:**
- Produces: `getContentSettingsSnapshot(): { ...field lama..., navbarButtons: { back: boolean; forward: boolean; reload: boolean; home: boolean; history: boolean; library: boolean; star: boolean } }`
- Produces (message): `emit('navbar-action', { action: 'history' | 'library' | 'settings' })` ditangani di `onMessage` -> `ui$.historyModalOpen/libraryModalOpen/settingsModalOpen.set(true)`.

- [ ] **Step 1: Write failing test** `lib/content-settings.test.ts`

```ts
import { describe, expect, test } from 'bun:test'
import { getNavbarButtons } from './content-settings'

describe('getNavbarButtons', () => {
  test('maps toolbar flags into navbar buttons', () => {
    expect(
      getNavbarButtons({
        showBackButtonInHeader: true,
        showForwardButtonInHeader: false,
        showReloadButtonInHeader: true,
        showHomeButtonInHeader: false,
        showHistoryButtonInHeader: true,
        showLibraryButtonInHeader: false,
        showStarButtonInHeader: true,
      }),
    ).toEqual({ back: true, forward: false, reload: true, home: false, history: true, library: false, star: true })
  })
})
```

- [ ] **Step 2: Run** `mise x bun@latest -- bun test lib/content-settings.test.ts` — expect FAIL (module not found).
- [ ] **Step 3: Implement** `lib/content-settings.ts`: pindahkan `getContentSettingsSnapshot` dari MainPageContent verbatim, tambah `export const getNavbarButtons = (s: SettingsSnapshot) => ({ back: s.showBackButtonInHeader, forward: s.showForwardButtonInHeader, reload: s.showReloadButtonInHeader, home: s.showHomeButtonInHeader, history: s.showHistoryButtonInHeader, library: s.showLibraryButtonInHeader, star: s.showStarButtonInHeader })`, dan sertakan `navbarButtons: getNavbarButtons(settings)` di snapshot. Ekspor keduanya.
- [ ] **Step 4: Run test** — expect PASS. Lalu `mise x bun@latest -- bun test` (regresi 369).
- [ ] **Step 5: MainPageContent** — import `getContentSettingsSnapshot` dari `@/lib/content-settings`, hapus salinan lokal; di `onMessage` switch tambah:

```ts
case 'navbar-action':
  if (data?.action === 'history') ui$.historyModalOpen.set(true)
  else if (data?.action === 'library') ui$.libraryModalOpen.set(true)
  else if (data?.action === 'settings') ui$.settingsModalOpen.set(true)
  break
```

- [ ] **Step 6: Commit** `git commit -m "Add navbarButtons to content settings and navbar-action bridge"`

### Task 2: Content — `content/navbar.ts` kolom tombol

**Files:**
- Modify: `content/icons.ts` (tambah `iconNavbarArrowBack`, `iconNavbarArrowForward`, `iconNavbarReload`, `iconNavbarHome`, `iconNavbarHistory`, `iconNavbarLibrary`, `iconNavbarSettings`; Material Symbols path 24x24, pola `iconDownload`)
- Create: `content/navbar.ts`
- Create: `content/navbar.test.ts`
- Modify: `content/main.ts` (import + panggil `installNavbarButtons()` di dalam blok `if (!window.electron)`)

**Interfaces:**
- Consumes: `window.NouTube.getSettings().navbarButtons` (Task 1), `noutubeSettingsEvent`, `emit`, `nouPolicy`/`innerHTML` pattern dari `content/menu.ts`, `window.NouTube.getVideoUrl()`.
- Produces: `export function installNavbarButtons(): void`; pure helper `export function buildNavbarButtons(flags: NavbarButtons): Array<{ id: string; icon: string; action: () => void } | null>` untuk test.

- [ ] **Step 1: Failing test** `content/navbar.test.ts` — `buildNavbarButtons` mengembalikan urutan [back?, forward?, reload?, home?, history?, library?, star?, settings] dengan `settings` selalu terakhir dan selalu ada; flag false -> slot null.

```ts
import { describe, expect, test } from 'bun:test'
import { buildNavbarButtons } from './navbar'

test('settings always present, flags filter the rest', () => {
  const list = buildNavbarButtons({ back: false, forward: false, reload: true, home: false, history: false, library: false, star: false })
  expect(list.filter(Boolean).map((b: any) => b.id)).toEqual(['reload', 'settings'])
})
```

- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement `content/navbar.ts`**:
  - `installNavbarButtons()`: buat `<div class="_nou_navbar_">` fixed `right:0; bottom:55%; display:flex; flex-direction:column; gap:2px; padding:6px 0; width:56px; border-radius:20px 0 0 20px; background:rgba(18,18,18,.9); backdrop-filter:blur(8px); box-shadow:-4px 0 16px rgba(0,0,0,.4); border:1px solid rgba(255,255,255,.08); border-right:none; z-index:9998`, append ke `document.body` (atau documentElement bila body belum ada — cek pola `injectCSS` di `content/css.ts` untuk timing).
  - Render isi via `buildNavbarButtons(window.NouTube.getSettings()?.navbarButtons ?? {})`; tiap tombol: div 44x44, `display:flex; align-items:center; justify-content:center`, innerHTML icon, `onclick` aksi.
  - Aksi: back `history.back()`, forward `history.forward()`, reload `location.reload()`, home `location.assign('https://m.youtube.com/')`, history `emit('navbar-action',{action:'history'})`, library `...'library'`, settings `...'settings'`, star: `const url = window.NouTube.getVideoUrl(); if (url) emit('star', { title: document.title, url })` (Review Focus 3).
  - Re-render pada `noutubeSettingsEvent` (Review Focus 2).
  - Guard SPA (Review Focus 1): `setInterval` 2s cek `document.querySelector('._nou_navbar_')`, pasang ulang bila hilang; sembunyikan (`style.display='none'`) saat `document.fullscreenElement` ada (Review Focus 4), tampilkan lagi saat keluar.
- [ ] **Step 4: Run test** — expect PASS; `mise x bun@latest -- bun test` full.
- [ ] **Step 5: `content/main.ts`** — `import { installNavbarButtons } from './navbar'`, panggil di dalam `if (!window.electron) { intercept(); installNavbarButtons() }`.
- [ ] **Step 6: Bundle check** `mise x bun@latest -- bun run bundle` — sukses tanpa error TS.
- [ ] **Step 7: Commit** `git commit -m "Inject app navbar buttons column into YouTube page"`

### Task 3: Settings UI label navbar (en/id)

**Files:**
- Modify: `locales/en.json`, `locales/id.json`
- Modify: `components/modal/SettingsModalTabSettings.tsx` (tanpa perubahan struktural — hanya key label yang diarahkan ulang bila perlu)

- [ ] **Step 1:** `en.json`: `settings.toolbarButtons` -> `"Navbar buttons"`; `showHomeButtonInHeader`/`showBackButtonInHeader`/`showForwardButtonInHeader`/`showReloadButtonInHeader`/`showHistoryButtonInHeader`/`showLibraryButtonInHeader`/`showStarButtonInHeader` -> `"Show X button in navbar"`. `id.json`: `"Tombol navbar"` dan `"Tampilkan tombol X di navbar"`.
- [ ] **Step 2:** `mise x bun@latest -- bun test` (locale files ter-parse di beberapa test).
- [ ] **Step 3: Commit** `git commit -m "Relabel toolbar button settings as navbar buttons"`

### Task 4: Build, install, verifikasi visual

**Files:** none (build only)

- [ ] **Step 1:** `mise x bun@latest -- bun run bundle && cd android && ANDROID_HOME=/home/muliaabdi/Android/Sdk ./gradlew assembleFullDebug`
- [ ] **Step 2:** Install ke tablet: `~/Android/Sdk/platform-tools/adb -s R9RWA02F66A install -r android/app/build/outputs/apk/full/debug/app-full-arm64-v8a-debug.apk`
- [ ] **Step 3:** Force-stop, launch, tunggu 8s, `screencap` -> pastikan kolom tombol tampil di atas navbar vertikal; tap tombol Settings (input tap koordinat kolom) -> screenshot modal Settings terbuka.
- [ ] **Step 4:** Push `git push origin android-only:main`.
