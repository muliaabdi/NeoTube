# Android-only + SponsorBlock categories + Country override + Settings-on-launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip repo ke mobile-only (Android + iOS) dan tambah tiga fitur: SponsorBlock per-kategori, content country override, settings terbuka duluan tiap launch (C-lite).

**Architecture:** Semua setelan baru lewat jalur settings yang sudah ada (`states/settings.ts` snapshot + normalize → `MainPageContent.getContentSettingsSnapshot` → `localStorage['nou:settings']` + `window.NouTube.setSettings` → dibaca `content/*`). Country override mengubah body POST `/youtubei/*` di hook fetch/XHR `content/intercept.ts` dan URL home via helper baru. C-lite hanya set `ui$.settingsModalOpen` sekali per launch.

**Tech Stack:** Expo 58 / React Native 0.88, legendapp state, bun test, content script TS di-bundle esbuild.

**Spec:** `docs/superpowers/specs/2026-11-08-android-only-and-features-design.md`

## Global Constraints

- Default kategori SponsorBlock: `sponsor`, `selfpromo`, `interaction`.
- Daftar kategori sah: `sponsor`, `selfpromo`, `interaction`, `intro`, `outro`, `preview`, `music_offtopic`, `poi_highlight`, `filler`.
- `contentCountry`: kode ISO 2 huruf uppercase atau `null`.
- `openSettingsOnLaunch` default `true`.
- Label UI bahasa Inggris hardcoded (ikuti baris "Sponsor block" yang sudah ada).
- Jangan tambah dependency baru.
- Test command: `bun test` (preload `test/setup.ts` sudah men-stub react-native/MMKV).
- Setiap task satu commit, pesan commit bahasa Inggris (konvensi repo: lihat `git log`).

## Review Focus

1. Kategori SponsorBlock kosong (user uncheck semua) → jangan kirim `categories=[]` ke API; fallback ke default atau skip fetch. Test di Task 3.
2. `contentCountry` tidak valid (huruf kecil, 3 huruf, angka) → dinormalisasi jadi `null`, tidak pernah dikirim mentah. Test di Task 2 & 4.
3. Import backup settings lama tanpa key baru → normalize mengisi default, tidak crash (jalur `lib/settings-transfer.ts` memakai `getSettingsSnapshot`). Test di Task 2.
4. Body request non-JSON / bukan string (FormData, undefined) → rewrite dilewati tanpa error. Test di Task 4.
5. URL yang sudah punya `gl` (mis. restoreOnStart ke watch URL) → `withContentCountry` mengganti nilai, tidak menduplikasi param. Test di Task 4.

---

### Task 1: Strip Android-only

**Files:**
- Delete: `desktop/`, `extension/`, `flatpak/`
- Delete: `.github/workflows/release-desktop.yml`, `.github/workflows/release-extension.yml`, `.github/workflows/flatpak-assets.yml`
- Modify: `package.json`

**Interfaces:**
- Consumes: tidak ada.
- Produces: repo tanpa workspace desktop/extension; `bun test` tetap hijau (test extension ikut terhapus).

- [ ] **Step 1: Hapus folder dan workflow**

`git rm -r desktop extension flatpak .github/workflows/release-desktop.yml .github/workflows/release-extension.yml .github/workflows/flatpak-assets.yml`

- [ ] **Step 2: Bersihkan package.json**

Hapus key `workspaces` dan script `web`. Script `bundle`, `dev`, `start`, `android`, `ios`, `lint` tetap.

- [ ] **Step 3: Refresh lockfile dan verifikasi**

Run: `bun install && bun test`
Expected: install sukses (lockfile berkurang), semua test PASS (tidak ada lagi `extension/lib/*.test.ts`).

Run: `bun run bundle:es`
Expected: `assets/scripts/main.bjs` ter-build tanpa error.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Remove desktop and extension workspaces, keep Android only"
```

### Task 2: Settings keys baru

**Files:**
- Modify: `states/settings.ts`
- Test: `states/settings.test.ts`

**Interfaces:**
- Consumes: pola `normalizeSettings` / `getSettingsSnapshot` yang sudah ada.
- Produces:
  - `states/settings.ts` export `SPONSOR_BLOCK_CATEGORIES: string[]` (9 nilai sah dari Global Constraints).
  - `states/settings.ts` export `DEFAULT_SPONSOR_BLOCK_CATEGORIES = ['sponsor', 'selfpromo', 'interaction']`.
  - `SettingsSnapshot.sponsorBlockCategories: string[]`, `SettingsSnapshot.contentCountry: string | null`, `SettingsSnapshot.openSettingsOnLaunch: boolean`.

- [ ] **Step 1: Tulis test gagal**

Tambah di `states/settings.test.ts`, mengikuti gaya test snapshot yang ada (lihat test `showDislikes`):

- `normalizeSettings({})` → `sponsorBlockCategories` sama dengan `DEFAULT_SPONSOR_BLOCK_CATEGORIES`, `contentCountry` `null`, `openSettingsOnLaunch` `true`.
- `normalizeSettings({ sponsorBlockCategories: ['sponsor', 'bogus', 'intro'], contentCountry: 'id', openSettingsOnLaunch: false })` → kategori `['sponsor', 'intro']`, country `'ID'`, launch `false`.
- `normalizeSettings({ contentCountry: 'xyz' })` dan `{ contentCountry: 'i' }` → `null`.
- `getSettingsSnapshot({ sponsorBlockCategories: [], contentCountry: 'id' })` → kategori kosong **dipertahankan** (user sengaja matikan semua; penanganan kosong ada di Task 3), country `'ID'`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `bun test states/settings.test.ts`
Expected: FAIL (property belum ada).

- [ ] **Step 3: Implementasi**

Di `SettingsSnapshot` + `Store` default + `normalizeSettings` + `getSettingsSnapshot`:
- `sponsorBlockCategories`: filter nilai yang ada di `SPONSOR_BLOCK_CATEGORIES`; `undefined`/bukan array → `DEFAULT_SPONSOR_BLOCK_CATEGORIES`; array (termasuk kosong) hasil filter dipakai apa adanya.
- `contentCountry`: string 2 huruf `^[A-Za-z]{2}$` → `.toUpperCase()`, selain itu `null`.
- `openSettingsOnLaunch`: `=== false ? false : true` (default on; hanya eksplisit false yang mematikan).
- Default `settings$`: `DEFAULT_SPONSOR_BLOCK_CATEGORIES`, `null`, `true`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `bun test states/settings.test.ts`
Expected: PASS semua.

- [ ] **Step 5: Commit**

```bash
git add states/settings.ts states/settings.test.ts
git commit -m "Add sponsorBlockCategories, contentCountry, openSettingsOnLaunch settings"
```

### Task 3: SponsorBlock categories ke API

**Files:**
- Modify: `content/sponsorblock.ts`, `content/player.ts`, `components/page/MainPageContent.tsx`
- Test: `content/sponsorblock.test.ts` (baru)

**Interfaces:**
- Consumes: `DEFAULT_SPONSOR_BLOCK_CATEGORIES` dari Task 2 (nilai sama, tapi content script tidak boleh import dari `states/` — deklarasi ulang literal yang sama di `content/sponsorblock.ts` sebagai `const DEFAULT_CATEGORIES`).
- Produces:
  - `content/sponsorblock.ts`: `getSponsorBlockCategories(): string[]` — baca `nou:settings` JSON, ambil `sponsorBlockCategories`, fallback `DEFAULT_CATEGORIES` bila bukan array. Array kosong dikembalikan apa adanya.
  - `content/sponsorblock.ts`: `getSkipSegments(videoId: string, categories: string[]): Promise<{ videoId: string; segments: Segment[] }>` — kategori kosong → resolve `{ videoId, segments: [] }` tanpa fetch; selain itu URL `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${encodeURIComponent(JSON.stringify(categories))}`.

- [ ] **Step 1: Tulis test gagal**

`content/sponsorblock.test.ts`, stub `localStorage` global (plain object dengan getItem) dan `fetch` (mock yang menangkap URL), ikuti pola stub di `lib/content-intercept.test.ts`:

- `getSponsorBlockCategories()` tanpa settings → `DEFAULT_CATEGORIES` 3 item.
- Settings `sponsorBlockCategories: ['sponsor','intro']` → dikembalikan.
- `getSkipSegments('abc', ['sponsor','intro'])` → fetch dipanggil sekali, URL mengandung `videoID=abc` dan `categories=` + encodeURIComponent `["sponsor","intro"]`.
- `getSkipSegments('abc', [])` → fetch tidak dipanggil, segments `[]`.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `bun test content/sponsorblock.test.ts`
Expected: FAIL (signature lama tanpa param `categories`).

- [ ] **Step 3: Implementasi**

- `content/sponsorblock.ts`: tambah `getSponsorBlockCategories` + ubah signature `getSkipSegments` sesuai Interfaces.
- `content/player.ts` (pemanggilan di `onStateChange`, sekitar baris 400): `getSkipSegments(videoId, getSponsorBlockCategories())`.
- `components/page/MainPageContent.tsx` `getContentSettingsSnapshot` (baris 117-149): destructure + include `sponsorBlockCategories`.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `bun test content/sponsorblock.test.ts && bun test`
Expected: PASS semua (test lama tidak regresi — `content/player.ts` bukan target test, cukup compile: `bun run bundle:es`).

Run: `bun run bundle:es`
Expected: build sukses.

- [ ] **Step 5: Commit**

```bash
git add content/sponsorblock.ts content/sponsorblock.test.ts content/player.ts components/page/MainPageContent.tsx
git commit -m "Filter SponsorBlock segments by selected categories"
```

### Task 4: Content country override

**Files:**
- Create: `lib/content-country.ts`
- Test: `lib/content-country.test.ts` (baru), `lib/content-intercept.test.ts` (extend)
- Modify: `content/intercept.ts`, `states/tabs.ts`, `components/page/MainPageContent.tsx`

**Interfaces:**
- Consumes: `settings$.contentCountry` dari Task 2; hook fetch/XHR di `content/intercept.ts`; `RE_INTERCEPT` di `lib/intercept.ts` (pencocok path `/youtubei/`).
- Produces:
  - `lib/content-country.ts`: `withContentCountry(url: string, country?: string | null): string` — `country` 2 huruf → set/replace param `gl` di URL; selain itu kembalikan `url` apa adanya. Pakai `URL` (relative URL resolve terhadap `https://m.youtube.com`).
  - `content/intercept.ts`: export `applyContentCountry(body: unknown, country?: string | null): unknown` — body string JSON dengan `context.client` objek → kembalikan string JSON dengan `context.client.gl = country`; selain itu (bukan string, bukan JSON, tanpa `context.client`) kembalikan body apa adanya.

- [ ] **Step 1: Tulis test gagal**

`lib/content-country.test.ts`:

- `withContentCountry('https://m.youtube.com', 'ID')` → `'https://m.youtube.com/?gl=ID'`.
- `withContentCountry('https://m.youtube.com/?gl=US', 'ID')` → `gl=ID` (diganti, satu `gl` saja).
- `withContentCountry('https://m.youtube.com/watch?v=x&gl=US', 'ID')` → `gl=ID`, param lain utuh.
- `withContentCountry('https://m.youtube.com', null)` dan `withContentCountry('https://m.youtube.com', 'xyz')` → url tidak berubah.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `bun test lib/content-country.test.ts`
Expected: FAIL (modul belum ada).

- [ ] **Step 3: Implementasi `withContentCountry`**

Satu fungsi murni di `lib/content-country.ts` per Interfaces.

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `bun test lib/content-country.test.ts`
Expected: PASS.

- [ ] **Step 5: Tulis test rewrite body (gagal)**

Extend `lib/content-intercept.test.ts` (stub window/FakeXHR sudah ada):

- `applyContentCountry('{"context":{"client":{"hl":"en"}},"browseId":"x"}', 'ID')` → hasil parse punya `context.client.gl === 'ID'` dan field lain utuh.
- `applyContentCountry(undefined, 'ID')` → `undefined`; `applyContentCountry('not json', 'ID')` → `'not json'`; `applyContentCountry('{"a":1}', 'ID')` → `'{"a":1}'`.
- Intergrasi fetch: mock `globalThis.fetch` menangkap body yang sampai; `window.NouTube.getSettings` return `{ contentCountry: 'ID', blockAds: true }`; panggil `intercept()` lalu `fetch('/youtubei/v1/browse', { method: 'POST', body: '{"context":{"client":{}}}' })` → fetch asli menerima body dengan `gl=ID`.
- Intergrasi XHR: setelah `intercept()`, `xhr.open('POST','/youtubei/v1/browse')` lalu `xhr.send(body)` — pastikan send hook mengubah body (simpan body di property helper `__nouSentBody` saat memanggil `xhrSend` asli, atau assert via FakeXHR.args/send capture).

- [ ] **Step 6: Jalankan, pastikan gagal**

Run: `bun test lib/content-intercept.test.ts`
Expected: FAIL (belum ada send hook / `applyContentCountry`).

- [ ] **Step 7: Implementasi rewrite**

- `applyContentCountry` di `content/intercept.ts` (parsing try/catch, kembalikan input saat ragu).
- Fetch hook (baris ~93): sebelum `winFetch`, bila pathname mengandung `/youtubei/` dan `settings.contentCountry` valid → ganti argumen body (`args[1] instanceof Request` → buat `Request` baru; selain itu → ganti `args[1].body`).
- XHR: di hook `open` simpan URL di `(this as any).__nouUrl`; tambah hook `XMLHttpRequest.prototype.send` yang memanggil `applyContentCountry(body, settings?.contentCountry)` sebelum `xhrSend.apply`. Simpan referensi `XMLHttpRequest.prototype.send` asli di scope `intercept()`.

- [ ] **Step 8: Pasang di URL home**

- `states/tabs.ts` `getDefaultTabUrl()` (baris 46): bungkus hasilnya `withContentCountry(url, settings$.contentCountry.get())` (import dari `@/lib/content-country`).
- `components/page/MainPageContent.tsx` baris 588: `const home = withContentCountry(isYTMusic ? ... : ..., settings$.contentCountry.get())`.
- `MainPageContent.getContentSettingsSnapshot`: include `contentCountry`.

- [ ] **Step 9: Jalankan semua**

Run: `bun test && bun run bundle:es`
Expected: PASS + build sukses.

- [ ] **Step 10: Commit**

```bash
git add lib/content-country.ts lib/content-country.test.ts lib/content-intercept.test.ts content/intercept.ts states/tabs.ts components/page/MainPageContent.tsx
git commit -m "Override content country via gl param and innertube body rewrite"
```

### Task 5: C-lite settings-on-launch + UI settings

**Files:**
- Modify: `app/index.tsx`, `components/modal/SettingsModalTabSettings.tsx`

**Interfaces:**
- Consumes: `openSettingsOnLaunch`, `sponsorBlockCategories`, `contentCountry` dari `states/settings.ts` (Task 2); `SPONSOR_BLOCK_CATEGORIES` untuk daftar UI; `withContentCountry` tidak dipakai di sini.
- Produces: tidak ada (task akhir UI).

- [ ] **Step 1: Auto-open settings per launch**

Di `app/index.tsx`, module scope: `let launchSettingsHandled = false`. Di dalam effect `getInitialURL` yang ada (baris 123-141): setelah resolve, bila `launchSettingsHandled` belum diset, set `true`, dan bila **semua** kondisi: `!url` (tidak ada deep link), `!isResolving && resolvedSharedPayloads.length === 0` (tidak ada share masuk), `settings$.openSettingsOnLaunch.get() === true` → `ui$.settingsModalOpen.set(true)`. Modal dirender `MainPage`; state observable bertahan sampai mount.

- [ ] **Step 2: UI rows**

Di `SettingsModalTabSettings.tsx` section "preferencesContent", setelah baris Sponsor block (baris 574-579):

1. Bila `settings.sponsorBlock` aktif: satu `SettingsToggleRow` per kategori `SPONSOR_BLOCK_CATEGORIES`, label kapital (`sponsor` → `Sponsor`, `music_offtopic` → `Music offtopic`), value = kategori ada di `settings.sponsorBlockCategories`, onPress toggle ke array.
2. Baris toggle `Open settings on launch` → `openSettingsOnLaunch`.
3. Baris input country: ikuti pola row klikbait-thumbnail (ikon + teks + kontrol kanan) — `TextInput` 2 huruf, `autoCapitalize="characters"`, `maxLength={2}`; ubah → `settings$.contentCountry.set(/^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : null)`. Hint teks: `Two-letter country code, e.g. ID, US. Empty = default.`

- [ ] **Step 3: Verifikasi**

Run: `bun test && bun run lint`
Expected: PASS, lint bersih. (Perilaku visual diverifikasi manual di Step 4 sebelum lanjut, bila emulator tersedia: `bun run android`.)

- [ ] **Step 4: Commit**

```bash
git add app/index.tsx components/modal/SettingsModalTabSettings.tsx
git commit -m "Open settings on launch and add category/country setting rows"
```
