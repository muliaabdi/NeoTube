# Playback Lokal dari Hasil Download — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menimpa player YouTube dengan `<video>` lokal saat watch page dibuka jika video tersebut sudah pernah di-download lewat yt-dlp, sehingga hemat kuota, tanpa buffering/iklan, dan siap offline.

**Architecture:** Indeks download (`videoId -> { uri/path, audioOnly, title }`) disimpan persisten di MMKV/IndexedDB dan disinkronkan ke `localStorage['nou:downloads']` di webview (pola sama seperti `nou:settings`). Konten webview (`content/local-playback.ts`) mengecek indeks saat membuka URL `/watch`; bila ada file video lokal, inject overlay `<video>` yang melayani file via origin virtual (`https://noutube-assets.local/downloads/<videoId>`) yang dicegat oleh `shouldInterceptRequest` (Android) / `interceptHttpRequest` (Desktop) dengan dukungan `Range` 206 partial. Player YouTube di-pause + mute saat overlay aktif; seek, speed, dan continue-watching dari history internal tetap jalan.

**Tech Stack:** TypeScript, React Native (Legend-State MMKV), Android Kotlin (`WebResourceResponse`, MediaStore), Electron Node.js (`net.fetch` / fs stream), Bun (content bundle).

**Spec:** `docs/superpowers/specs/2026-11-10-local-playback-design.md`

## Global Constraints

- Platform: Android dan Desktop (iOS bridge menjawab tidak ada file lokal).
- Cakupan: `/watch` saja; `/shorts` dan embed tetap streaming biasa.
- Format: hanya download video yang memicu overlay; `audioOnly: true` diabaikan oleh overlay.
- Perilaku akhir video: berhenti di `ended` + tampilkan tombol replay (autoplay YouTube tidak jalan).
- Player YouTube dikunci: paused + muted selama overlay aktif; tidak boleh resume di background.
- History: posisi tersimpan ke `history$` (MMKV) internal NouTube.
- Backfill: v1 tidak mem-backfill download lama (hanya download baru yang tercatat di indeks).

## Review Focus

1. **File terhapus dari disk**: indeks masih mencatat entry, tapi file di MediaStore/disk sudah dihapus user -> overlay gagal load -> fallback diam-diam ke streaming YouTube normal tanpa crash/layar hitam.
2. **Seek forward/backward di Android**: stream MediaStore tanpa header `Range` membuat `<video>` tidak bisa seek -> `shouldInterceptRequest` wajib menghasilkan status 206 dengan `Content-Range`.
3. **Navigasi SPA cepat**: user klik video rekomendasi lain saat overlay aktif -> overlay lama dibersihkan tuntas, video YouTube baru tidak terkunci dalam kondisi muted/paused.
4. **PiP saat overlay aktif**: swipe up ke home screen saat video lokal diputar -> PiP memilih `<video>` overlay, bukan `<video>` YouTube yang sedang pause di baliknya.
5. **Download audio-only**: download mp3 lalu buka watch page yang sama -> overlay TIDAK muncul, YouTube streaming normal.

---

### Task 1: Store & Sinkronisasi Indeks Download

**Files:**
- Create: `states/downloads-index.ts`
- Test: `states/downloads-index.test.ts`
- Modify: `components/page/MainPageContent.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface LocalVideoEntry {
    videoId: string
    uri: string // content:// URI (Android) atau file:/// absolute path (Desktop)
    formatId: string
    title: string
    audioOnly: boolean
    downloadedAt: number
  }
  export const localVideos$: Observable<Record<string, LocalVideoEntry>>
  export function recordDownloadedVideo(entry: Omit<LocalVideoEntry, 'downloadedAt'>): void
  export function extractVideoId(url: string): string | null
  ```

- [ ] **Step 1: Tulis failing test di `states/downloads-index.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'bun:test'
import { extractVideoId, localVideos$, recordDownloadedVideo } from './downloads-index'

describe('downloads-index', () => {
  beforeEach(() => {
    localVideos$.set({})
  })

  it('extracts videoId from watch URL, shorts, and youtu.be', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(extractVideoId('https://www.youtube.com/feed/subscriptions')).toBeNull()
  })

  it('records downloaded video with audioOnly flag derived from formatId', () => {
    recordDownloadedVideo({
      videoId: 'abc123xyz',
      uri: '/path/to/video.mp4',
      formatId: 'bestvideo+bestaudio/best',
      title: 'Sample Video',
      audioOnly: false,
    })
    const entry = localVideos$['abc123xyz'].get()
    expect(entry).toBeDefined()
    expect(entry.audioOnly).toBe(false)
    expect(entry.uri).toBe('/path/to/video.mp4')
  })

  it('flags mp3 and audio-only formats as audioOnly', () => {
    recordDownloadedVideo({
      videoId: 'aud123',
      uri: '/path/to/audio.mp3',
      formatId: 'bestaudio-mp3',
      title: 'Sample Audio',
      audioOnly: true,
    })
    expect(localVideos$['aud123'].get().audioOnly).toBe(true)
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `bun test states/downloads-index.test.ts`
Expected: FAIL ("cannot find module ./downloads-index")

- [ ] **Step 3: Implementasikan `states/downloads-index.ts`**

Gunakan Legend-State MMKV / IndexedDB (pola persis `states/history.ts`).

- [ ] **Step 4: Jalankan test dan pastikan lolos**

Run: `bun test states/downloads-index.test.ts`
Expected: PASS

- [ ] **Step 5: Sambungkan ke listener download selesai di `MainPageContent.tsx`**

Pada callback `onDownloadProgress` saat `payload.done && !payload.error` (baris ~513):
1. Panggil `extractVideoId(payload.url)`
2. Jika ada, panggil `recordDownloadedVideo` dengan `uri: payload.filePath`
3. Buat `syncLocalVideosToWebview()` (useCallback baru, dipanggil juga saat app start):
   - Inject `localStorage.setItem('nou:downloads', JSON.stringify(localVideos$.get()))` ke semua `nativeViews()` (pola sama `syncSettingsToWebview`)
   - Panggil `mainClient.syncLocalMediaIndex(JSON.stringify(localVideos$.get()))` — fungsi native baru (Android: expo module `Function`; Desktop: uiClient IPC) supaya penyaji file tahu `videoId -> uri/path`

- [ ] **Step 6: Commit**

```bash
git add states/downloads-index.ts states/downloads-index.test.ts components/page/MainPageContent.tsx
git commit -m "feat(downloads): persist local video index and sync to webview storage"
```

---

### Task 2: Setting `localPlayback`

**Files:**
- Modify: `states/settings.ts`
- Modify: `components/modal/SettingsModalTabSettings.tsx`
- Modify: `locales/en.json`
- Modify: `locales/id.json`

**Interfaces:**
- Consumes: `SettingsSnapshot` dari `states/settings.ts`
- Produces: `settings.localPlayback: boolean` (default `true`)

- [ ] **Step 1: Tambahkan properti setting ke `states/settings.ts`**

1. Tambah `localPlayback: boolean` ke `SettingsSnapshot`
2. Di `normalizeSettings`, jika `typeof data.localPlayback !== 'boolean'`, set `data.localPlayback = true`
3. Tambah default `localPlayback: true` pada `createDefaultSettingsSnapshot`

- [ ] **Step 2: Tambahkan teks i18n di `locales/en.json` dan `locales/id.json`**

- `en.json`:
  ```json
  "localPlayback": "Play downloaded videos locally",
  "localPlaybackHint": "Overlay the YouTube player with the saved file when opening a downloaded video"
  ```
- `id.json`:
  ```json
  "localPlayback": "Putar video unduhan secara lokal",
  "localPlaybackHint": "Gantikan player YouTube dengan file tersimpan saat membuka video yang sudah diunduh"
  ```

- [ ] **Step 3: Tambahkan switch item di `components/modal/SettingsModalTabSettings.tsx`**

Item `NouListItemSwitch` dengan icon `file-download-done`, label `t('settings.localPlayback')`, hint, value `settings.localPlayback`, onPress toggle `settings$.localPlayback`.

- [ ] **Step 4: Verifikasi sinkronisasi settings**

Verifikasi `syncSettingsToWebview` di `MainPageContent.tsx` otomatis membawa properti baru karena mem-pass seluruh `settings$.get()`.

- [ ] **Step 5: Commit**

```bash
git add states/settings.ts components/modal/SettingsModalTabSettings.tsx locales/en.json locales/id.json
git commit -m "feat(settings): add localPlayback toggle"
```

---

### Task 3: Pencegat Virtual Origin Android (Range 206)

**Files:**
- Modify: `modules/nou-tube-view/android/src/main/java/expo/modules/noutubeview/NouTubeView.kt`
- Create: `modules/nou-tube-view/android/src/main/java/expo/modules/noutubeview/NouLocalMediaServer.kt`

**Interfaces:**
- Virtual Origin URL: `https://noutube-assets.local/downloads/{videoId}`
- Consumes: Header HTTP `Range` dari `WebResourceRequest`
- Produces: `WebResourceResponse` (status 206 Partial Content atau 200) dengan MIME type `video/mp4`

- [ ] **Step 1: Buat helper `NouLocalMediaServer.kt`**

Helper untuk melayani `Uri` MediaStore atau file path dengan parsing `Range: bytes=start-end`:
```kotlin
object NouLocalMediaServer {
  fun openResponse(context: Context, uriString: String, rangeHeader: String?): WebResourceResponse?
}
```
1. Resolve URI (jika `content://` pakai `context.contentResolver.openAssetFileDescriptor`, jika `file://` pakai `File`)
2. Jika file tidak ada, kembalikan `WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, null)`
3. Baca `length` file
4. Parse range `bytes=start-end`. Jika ada:
   - Hitung `contentLength = end - start + 1`
   - Buka `InputStream`, skip `start` bytes
   - Response status 206, header `Content-Range: bytes $start-$end/$total`, `Content-Length: $contentLength`, `Accept-Ranges: bytes`
5. Jika tanpa range: status 200, `Content-Length: $total`, `Accept-Ranges: bytes`

- [ ] **Step 2: Kaitkan di `NouTubeView.kt` `shouldInterceptRequest`**

```kotlin
val url = request.url
if (url.host == "noutube-assets.local" && url.path?.startsWith("/downloads/") == true) {
  val videoId = url.lastPathSegment ?: return null
  val localUri = NouLocalMediaRegistry.getUri(videoId) ?: return null
  val range = request.requestHeaders["Range"]
  return NouLocalMediaServer.openResponse(context, localUri, range)
}
```

- [ ] **Step 3: Buat registry native `NouLocalMediaRegistry.kt` + module function**

Objek singleton thread-safe sederhana `ConcurrentHashMap<String, String>()` (`videoId -> uri`) dengan `set(json: String)` (parse array `LocalVideoEntry` RN) dan `getUri(videoId)`.
Daftarkan expo module `Function("syncLocalMediaIndex") { json: String -> NouLocalMediaRegistry.set(json) }` di `NouTubeViewModule.kt` (dipanggil `mainClient.syncLocalMediaIndex` dari Task 1).
MIME: dari ekstensi file (`mp4` -> `video/mp4`, `webm` -> `video/webm`, fallback `application/octet-stream`).

- [ ] **Step 4: Commit**

```bash
git add modules/nou-tube-view/android/src/main/java/expo/modules/noutubeview/NouLocalMediaServer.kt \
        modules/nou-tube-view/android/src/main/java/expo/modules/noutubeview/NouLocalMediaRegistry.kt \
        modules/nou-tube-view/android/src/main/java/expo/modules/noutubeview/NouTubeView.kt
git commit -m "feat(android): serve downloaded media with Range support for video seeking"
```

---

### Task 4: Pencegat Virtual Origin Desktop (Range 206)

**Files:**
- Modify: `desktop/src/main/lib/intercept.ts`
- Modify: `desktop/src/main/ipc/main.ts`

**Interfaces:**
- Virtual Origin URL: `https://noutube-assets.local/downloads/{videoId}`
- Consumes: `videoId -> filePath` dari state IPC desktop
- Produces: Stream partial dari fs node

- [ ] **Step 1: Buat registry path di `desktop/src/main/lib/local-media.ts`**

Registry in-memory di main process `videoId -> absolutePath` yang diisi via IPC channel `setLocalMediaIndex`.

- [ ] **Step 2: Daftarkan handler `protocol.handle` untuk origin virtual**

Gunakan `protocol.handle('https', ...)` di `app.whenReady()` (setelah `interceptHttpRequest()`), BUKAN menumpang `interceptHttpRequest` (yang berbasis `webRequest` dan tidak bisa membalas Response sendiri):
1. Dalam handler: jika URL ber-prefix `https://noutube-assets.local/downloads/`, parse `videoId`
2. Cek registry, verifikasi `fs.existsSync`
3. Jika tidak ada: `new Response(null, { status: 404 })`
4. Baca `fs.statSync(path).size`, parse header `Range` dari `request.headers`
5. Buka `fs.createReadStream(path, { start, end })`, balas `new Response(stream, { status: 206, headers: { 'Content-Range': ..., 'Content-Length': ..., 'Accept-Ranges': 'bytes', 'Content-Type': mime } })`; tanpa Range -> 200 full stream
6. URL lain: `return net.fetch(request)` (pass-through, jangan ganggu trafik YouTube)

- [ ] **Step 3: Isi registry dari renderer**

Tambah method `setLocalMediaIndex(json)` di `desktop/src/renderer/ipc/ui.ts` (pola `uiClient` yang ada) yang mengirim indeks ke main via channel yang sudah ada; main menyimpan ke registry Task 4 Step 1. Dipanggil dari `MainPageContent.syncLocalVideosToWebview` (Task 1) — di platform desktop `mainClient.syncLocalMediaIndex` diarahkan ke sini.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/main/lib/local-media.ts desktop/src/main/lib/intercept.ts desktop/src/main/ipc/main.ts
git commit -m "feat(desktop): serve downloaded media via virtual origin with Range support"
```

---

### Task 5: Content Script Overlay Player & Kontrol

**Files:**
- Create: `content/local-playback.ts`
- Test: `content/local-playback.test.ts`
- Modify: `content/main.ts`
- Modify: `content/picture-in-picture.ts`

**Interfaces:**
- Consumes: `localStorage['nou:downloads']`, `localStorage['nou:settings']`
- URL: `https://noutube-assets.local/downloads/<videoId>`
- Produces: Custom element overlay di atas `#movie_player`

- [ ] **Step 1: Tulis unit test logika gating & URL di `content/local-playback.test.ts`**

```ts
import { describe, it, expect } from 'bun:test'
import { shouldTriggerLocalPlayback, getLocalVideoUrl } from './local-playback'

describe('local playback gating', () => {
  it('triggers only on /watch with localPlayback setting enabled and non-audio entry', () => {
    const downloads = {
      vid1: { videoId: 'vid1', uri: 'file://x.mp4', audioOnly: false },
      aud1: { videoId: 'aud1', uri: 'file://x.mp3', audioOnly: true },
    }
    expect(shouldTriggerLocalPlayback('/watch', 'vid1', downloads, true)).toBe(true)
    expect(shouldTriggerLocalPlayback('/watch', 'vid1', downloads, false)).toBe(false) // setting off
    expect(shouldTriggerLocalPlayback('/watch', 'aud1', downloads, true)).toBe(false) // audio only
    expect(shouldTriggerLocalPlayback('/shorts/vid1', 'vid1', downloads, true)).toBe(false) // non-watch
    expect(shouldTriggerLocalPlayback('/watch', 'unknown', downloads, true)).toBe(false)
  })

  it('builds virtual origin URL correctly', () => {
    expect(getLocalVideoUrl('vid1')).toBe('https://noutube-assets.local/downloads/vid1')
  })
})
```

- [ ] **Step 2: Jalankan test dan pastikan gagal**

Run: `bun test content/local-playback.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementasikan `content/local-playback.ts`**

1. Ekspor `shouldTriggerLocalPlayback` dan `getLocalVideoUrl`
2. Fungsi `mountLocalOverlay(videoId: string)`:
   - Cari anchor `#movie_player` (tunggu via MutationObserver / retry jika belum ada)
   - Pause + mute player YouTube asli (`const yt = document.querySelector('video'); yt?.pause(); yt?.muted = true;`)
   - Pasang observer/guard: cegah player YouTube resume sendiri saat overlay aktif
   - Buat container overlay absolute inset 0, zIndex tinggi, background hitam
   - Buat `<video>` di dalam container, src `https://noutube-assets.local/downloads/${videoId}`
   - Baca start time via round-trip yang ada: `emit('local-playback-start', { videoId })`; RN (Task 6) menjawab dengan `executeJavaScript('window.NouTube.setLocalPosition("<videoId>", <seconds>)')`; overlay menunggu callback itu maksimal 500ms (default 0), lalu set `currentTime`
   - Buat bar kontrol minimal: play/pause, seekbar, label waktu, speed selector, dan tombol "Tonton dari YouTube" (unmount overlay, unmute + play player YouTube)
   - Tangani event `ended`: berhenti, tampilkan tombol replay
   - Jika `<video>` error (misal file fisik 404): otomatis panggil unmount dan fallback ke player YouTube
3. Fungsi `unmountLocalOverlay()`: hapus DOM overlay, lepas guard YouTube, kembalikan kontrol
4. Listen navigasi SPA (`yt-navigate-finish`, `popstate`): unmount overlay lama, cek videoId baru

- [ ] **Step 4: Update `content/picture-in-picture.ts`**

Ubah selektor video agar mengutamakan video overlay jika ada:
```ts
const video = document.querySelector('video._nou_local_player') || document.querySelector('video')
```
Pastikan `reportPictureInPictureVideo` dan `setPictureInPicture` menarget video overlay saat aktif.

- [ ] **Step 5: Bundle content script**

Run: `bun bundle`
Pastikan `assets/scripts/main.bjs` ter-generate tanpa error.

- [ ] **Step 6: Jalankan test**

Run: `bun test content/local-playback.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add content/local-playback.ts content/local-playback.test.ts content/main.ts content/picture-in-picture.ts assets/scripts/main.bjs
git commit -m "feat(player): inject local video overlay with controls on downloaded videos"
```

---

### Task 6: Sinkronisasi Watch History

**Files:**
- Modify: `content/local-playback.ts`
- Modify: `components/page/MainPageContent.tsx`

**Interfaces:**
- Consumes: event `timeupdate` dari `<video>` overlay; pesan `local-playback-start` dari page
- Produces: pesan `playback` ke host agar tercatat di `history$`; balasan `window.NouTube.setLocalPosition(videoId, seconds)` via `executeJavaScript`

- [ ] **Step 1: Kirim update posisi dari overlay ke host**

Di `content/local-playback.ts`:
Setiap 2 detik saat `timeupdate` pada video overlay, panggil:
```ts
emit('playback', {
  videoId,
  title: document.title,
  duration: video.duration,
  currentTime: video.currentTime,
  playing: !video.paused,
})
```

- [ ] **Step 2: Catat history + jawab posisi resume di `MainPageContent.tsx`**

1. Verifikasi handler `onMessage` (kanal `playback`) memanggil `history$.addHistory(...)` — jika kanal `playback` sudah menangani pesan YouTube player dengan bentuk sama, pastikan overlay-compatible.
2. Tambah handler kanal `local-playback-start`: cari entry `history$` dengan `videoId` sama, ambil `current`, balas `getNoutube()?.executeJavaScript?.('window.NouTube.setLocalPosition(...)')` ke webview pengirim. Tambahkan `setLocalPosition` ke objek `window.NouTube` yang dibangun `content/noutube.ts`.

- [ ] **Step 3: Commit**

```bash
git add content/local-playback.ts components/page/MainPageContent.tsx assets/scripts/main.bjs
git commit -m "feat(history): track local video playback position in watch history"
```

---

### Task 7: Verifikasi Akhir & Manual Checklist

**Files:**
- None (verifikasi only)

- [ ] **Step 1: Jalankan semua unit test**

Run: `bun test`
Expected: Semua test lolos (termasuk test baru di task 1 dan 5).

- [ ] **Step 2: Jalankan linter**

Run: `bun run lint`
Expected: 0 error.

- [ ] **Step 3: Jalankan bundle check**

Run: `bun bundle`
Expected: Bundle sukses, size wajar.

- [ ] **Step 4: Uji manual di Android/Desktop (sesuai ketersediaan device)**

Skenario checklist:
1. Download satu video dari `/watch`
2. Kembali ke halaman yang sama -> overlay muncul seketika, video diputar dari file lokal
3. Seek ke menit 5 -> video berpindah lancar (verifikasi Range 206)
4. Masuk PiP (swipe up / menu) -> video lokal mengecil ke floating window
5. Hapus file video dari file manager -> refresh watch page -> fallback otomatis streaming YouTube tanpa crash
6. Buka download audio-only (mp3) -> streaming YouTube normal, overlay tidak aktif
7. Matikan setting `localPlayback` -> video streaming biasa dari YouTube
