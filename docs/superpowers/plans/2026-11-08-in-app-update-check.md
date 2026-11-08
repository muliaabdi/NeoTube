# In-App Update Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App otomatis tahu versi baru dari GitHub Releases dan menampilkan banner menetap di About.

**Architecture:** Pure lib (fetch+compare, bun-testable) -> state MMKV (hasil + throttle 24h) -> mainClient mobile impl -> startup hook di MainPageContent -> banner di SettingsTree About.

**Tech Stack:** TypeScript, @legendapp/state + ObservablePersistMMKV, global fetch, i18next.

**Spec:** `docs/superpowers/specs/2026-11-08-in-app-update-check-design.md`

## Global Constraints

- Repo target: `https://api.github.com/repos/muliaabdi/NeoTube/releases/latest` (unauth).
- Bandingkan `tag_name` (strip awalan `v`) vs `version` package.json (`import { version } from '../../package.json'` — pola SettingsModal.tsx:2).
- Versi app saat ini: `0.7.6`; rilis pertama akan `v1.0.0` (bump package.json saat rilis, bukan di task fitur).
- Locale: hanya `locales/en.json` + `locales/id.json` (fallback repo).
- Toast: `showToast` dari `@/lib/toast`. Persist: pola `syncObservable` + `ObservablePersistMMKV` (states/settings.ts:428).
- Desktop/electron path tidak diubah; perubahan `UpdateCheckResult` hanya tambah field opsional.
- Semua modul baru harus bisa di-import `bun test` tanpa expo (pola lazy-require bila perlu).

## Review Focus

- Offline/timeout saat startup: tidak crash, state lama dipertahankan, tidak spam retry.
- 404 belum ada rilis: hasil `not-available`, bukan error toast.
- Tag `v1.0.0` vs versi `1.0.0`: sama (bukan "tersedia").
- Prerelease (`v1.1.0-beta`): tidak dianggap update (releases/latest memang tak mengembalikan prerelease; compare juga harus tak gagal).
- Throttle: buka-tutup app berkali dalam 24 jam = hanya 1 fetch.

---

### Task 1: `lib/check-update.ts` — pure fetch + compare

**Files:**
- Create: `lib/check-update.ts`
- Test: `lib/check-update.test.ts`

**Interfaces:**
- Produces:
  - `RELEASES_LATEST_URL: string`
  - `compareVersions(a: string, b: string): number` — strip `v`, numeric per segment, suffix (mis. `-beta`) diabaikan; return >0 jika a lebih baru.
  - `fetchLatestRelease(fetchFn: typeof fetch): Promise<{ status: 'not-available' } | { status: 'available'; version: string; url: string } | { status: 'error'; message?: string }>` — GET RELEASES_LATEST_URL, Accept `application/vnd.github+json`; HTTP 404 -> not-available; HTTP tidak ok lain -> error; body JSON `tag_name`/`html_url`; tag tanpa `v` tetap diterima.

- [ ] **Step 1: Tulis test gagal**

Test untuk: `compareVersions('v1.0.0','0.7.6')>0`, `compareVersions('1.0.0','v1.0.0')===0`, `compareVersions('0.7.6','1.0.0')<0`, `compareVersions('1.0.0-rc1','1.0.0')<0`, `compareVersions('1.2','1.2.0')===0`; `fetchLatestRelease` dengan fake fetch: 200+`{"tag_name":"v1.0.0","html_url":"u"}` -> available `{version:'1.0.0',url:'u'}`; 404 -> not-available; 500 -> error; fetch throw -> error.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `mise x bun@latest -- bun test lib/check-update.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implementasi**

compareVersions: `s.replace(/^v/,'').split(/[.-]/)` bandingkan numeric segmen (segmen hilang = 0). fetchLatestRelease: parse sederhana, try/catch.

- [ ] **Step 4: Test lulus**

Run: `mise x bun@latest -- bun test lib/check-update.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/check-update.ts lib/check-update.test.ts && git commit -m "Add pure GitHub release check and version compare"
```

### Task 2: `states/update.ts` — state + throttle

**Files:**
- Create: `states/update.ts`
- Test: `states/update.test.ts`

**Interfaces:**
- Consumes: `fetchLatestRelease`, `compareVersions` dari Task 1.
- Produces:
  - `update$ = observable({ availableVersion: null as string | null, releaseUrl: null as string | null, checkedAt: 0 })` + `syncObservable` persist name `'update'` (plugin MMKV, pola settings).
  - `shouldCheck(checkedAt: number, now: number): boolean` — true jika `now - checkedAt > 24*3600*1000`.
  - `async runUpdateCheck(currentVersion: string): Promise<void>` — jika `shouldCheck(update$.checkedAt.get(), Date.now())` false -> return; fetch; hasil available & `compareVersions(latest, currentVersion) > 0` -> set availableVersion/releaseUrl, else set null; selalu set checkedAt (kecuali error sebelum fetch selesai); error -> diam (console.error saja).

- [ ] **Step 1: Test gagal**

`shouldCheck(0, 1)` true; `shouldCheck(t, t+23h)` false; `shouldCheck(t, t+25h)` true. `runUpdateCheck` dengan globalThis.fetch di-stub (bun test): tersedia -> state terisi; throttle -> tidak fetch (hitung panggilan); error fetch -> state lama tak berubah, checkedAt ter-update? — putuskan: error -> checkedAt TIDAK di-update (retry saat buka berikutnya). Tulis asersi sesuai.

- [ ] **Step 2: Gagal dulu**

Run: `mise x bun@latest -- bun test states/update.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implementasi**

Mirror persist pattern states/settings.ts:428. MMKV plugin di-import top-level (settings.test.ts sudah membuktikan aman di bun).

- [ ] **Step 4: Lulus**

Run: `mise x bun@latest -- bun test states/update.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add states/update.ts states/update.test.ts && git commit -m "Add persisted update-check state with 24h throttle"
```

### Task 3: `lib/main-client.ts` — aktifkan mobile

**Files:**
- Modify: `lib/main-client.ts:15-18` (type), `:129-134` (impl)

**Interfaces:**
- Consumes: `fetchLatestRelease`, `compareVersions` (Task 1), `version` dari `../package.json`.
- Produces: `UpdateCheckResult` 'available' kini `{ status: 'available'; version: string; url?: string }`; `mainClient.isUpdateSupported()` -> `true`; `mainClient.checkForUpdate()` -> `fetchLatestRelease(fetch)` lalu bandingkan dengan `version` -> available/not-available; fetch error -> `{status:'error', message}`.

- [ ] **Step 1: Implement + run full tests**

Type union tambah `url?` (additive; tidak memecah pemanggil lama). Ganti dua method stub. Run: `mise x bun@latest -- bun test 2>&1 | tail -3`
Expected: 0 fail (jumlah test ≥ Task 2).

- [ ] **Step 2: Commit**

```bash
git add lib/main-client.ts && git commit -m "Check GitHub releases from the mobile client"
```

### Task 4: Startup hook + banner About + handler manual

**Files:**
- Modify: `components/page/MainPageContent.tsx` (satu useEffect startup)
- Modify: `components/modal/SettingsTree.tsx:223-240` (handler), About section `:378-391` (banner)
- Modify: `locales/en.json`, `locales/id.json` (section `update`)

**Interfaces:**
- Consumes: `update$`, `runUpdateCheck` (Task 2); `compareVersions` (Task 1); prop `version` SettingsTree.
- Produces: tanpa ekspor baru.

- [ ] **Step 1: MainPageContent — startup check**

`useEffect(() => { runUpdateCheck(version) }, [])` (import `version` dari `../../package.json` seperti SettingsModal). Baris ini satu-satunya perubahan file ini.

- [ ] **Step 2: SettingsTree — banner + handler**

Handler `handleCheckForUpdate` (`:223`): `available` -> `update$.availableVersion.set(result.version)`, `update$.releaseUrl.set(result.url)` bila ada, toast `t('update.available', { version })`, `Linking.openURL(result.url)` bila ada. (Ganti toast `update.downloading`.)
About (`:378`): bila `update$.availableVersion.get()` truthy -> render `SettingsActionRow` label `t('update.available', {version})`, description `t('update.openRelease')`, icon `new-releases`, onPress `Linking.openURL(update$.releaseUrl.get())`, di atas section Updates.

- [ ] **Step 3: Locale keys**

en: `"available": "Update v{{version}} available"`, `"openRelease": "Tap to open the release page"`. id: `"available": "Pembaruan v{{version}} tersedia"`, `"openRelease": "Tap untuk membuka halaman rilis"`. (Key `update.check`, `checkHint`, `upToDate`, `error` sudah ada.)

- [ ] **Step 4: Full tests + bundle**

Run: `mise x bun@latest -- bun test 2>&1 | tail -3 && mise x bun@latest -- bun run bundle 2>&1 | tail -1`
Expected: 0 fail, bundle sukses.

- [ ] **Step 5: Commit**

```bash
git add components/page/MainPageContent.tsx components/modal/SettingsTree.tsx locales/en.json locales/id.json && git commit -m "Show update banner in About and check on startup"
```

### Task 5: Build device + rilis v1.0.0 + verifikasi end-to-end

**Files:**
- Modify: `package.json` (bump `version` -> `1.0.0`)

Device: tablet `R9RWA02F66A`.

- [ ] **Step 1: Build + install APK versi lama (0.7.6, kode baru)**

`cd android && ./gradlew assembleFullDebug && adb install -r app/build/outputs/apk/full/debug/app-full-arm64-v8a-debug.apk`

- [ ] **Step 2: Buat release v1.0.0**

Bump package.json -> `1.0.0`, commit `Bump version to 1.0.0`, tag `v1.0.0`, push, `gh release create v1.0.0` (API curl dengan token) notes singkat.

- [ ] **Step 3: Verifikasi device (WAJIB sebelum push final)**

Launch app -> buka Settings/About: banner "Pembaruan v1.0.0 tersedia" muncul; tap -> browser halaman rilis; tombol "Check for updates" -> toast tersedia; buka-tutup app kedua kali: hanya 1 request (logcat/cek tidak praktis — minimal tidak ada toast/error ganda).

- [ ] **Step 4: Reinstall final (1.0.0) + verifikasi banner hilang**

Build ulang + install: About tidak menampilkan banner; "Check for updates" -> "Anda pakai versi terbaru".

- [ ] **Step 5: Push**

```bash
git push origin android-only:main
```
Verifikasi CI Test hijau, lalu selesai.
