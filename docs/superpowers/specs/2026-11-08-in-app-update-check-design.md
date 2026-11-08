# In-App Update Info — Design

Date: 2026-11-08 · Status: proposed

## Intent
App memberi tahu sendiri saat ada versi baru di GitHub Releases (muliaabdi/NeoTube), tanpa download/install otomatis. Pilihan pendekatan B: cek otomatis tiap app dibuka (throttle 24 jam), hasil menetap sebagai banner di halaman About sampai user bertindak.

## Goals
- Cek otomatis di startup app; 1x/24 jam (persist), manual via tombol "Check for updates" yang sudah ada.
- Banner menetap di About: "Versi baru vX tersedia" -> tap buka halaman rilis di browser.
- Modul cek versi pure + testable (bun), pola lazy-require agar tidak menyeret expo.

## Non-goals
- Tidak ada auto-download/install APK/OTA (expo-updates), tidak ada polling background.
- Jalur desktop (electron-updater) tidak diubah.

## Constraints
- Sumber data: `GET https://api.github.com/repos/muliaabdi/NeoTube/releases/latest` (unauth, limit 60 req/jam — cukup). 404 = belum ada rilis -> not-available.
- Bandingkan `tag_name` (strip `v`) vs `version` package.json.

## Approaches
- A toast sekali — info terlewat hilang. Ditolak.
- **B banner menetap + cek startup — dipilih: info tidak terlewat.**
- C keduanya — toast redundan.

## How (rencana file)
- `lib/check-update.ts` (baru, pure): `compareVersions(a, b)`, `fetchLatestRelease(fetch)` -> `{status, version?, url?}`; timeout pendek.
- `states/update.ts` (baru): observable MMKV `{availableVersion, releaseUrl, checkedAt}`.
- `lib/main-client.ts` (mobile impl): `isUpdateSupported()` -> true; `checkForUpdate()` -> pakai lib; `UpdateCheckResult` ditambah `url?`.
- `components/page/MainPageContent.tsx`: startup effect cek (throttle).
- `components/modal/SettingsTree.tsx` About: banner row bila `availableVersion > version`; handler manual check disesuaikan (available -> simpan + buka URL, toast "vX tersedia" — bukan "downloading").
- `locales/en.json`, `locales/id.json`: kunci baru (`update.available`, `update.openRelease`).
- Sekali saja: buat tag `v1.0.0` + release manual sebagai data pertama.

## Left to builder
- Penempatan persis banner (di atas section "Updates" About).
- Locale selain en/id fallback key en (konsisten kebijakan repo).
