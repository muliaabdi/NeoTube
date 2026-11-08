# Mobile-only (Android + iOS) + 3 fitur — design

Tanggal: 2026-11-08
Status: menunggu persetujuan

## Intent

Fork NouTube jadi app mobile saja — Android dan iOS (lebih simpel), plus tiga
fitur terinspirasi SmartTube/ProTube: SponsorBlock per-kategori, content
country override, dan settings tampil duluan tiap launch.

## Goals

1. Repo hanya build Android + iOS; desktop/extension hilang dari repo dan CI.
2. SponsorBlock: user pilih kategori segment yang di-skip.
3. Country override: rekomendasi/home feed ikut negara pilihan tanpa login.
4. Tiap launch, `SettingsModal` terbuka duluan di atas webview (C-lite).

## Non-goals

- Tidak mengubah behavior i18n, sync Supabase, download, feed.
- Bukan landing screen native (C-full) — dicoba C-lite dulu.
- iOS tetap didukung penuh (script `ios`, billing, tests tetap); hanya
  desktop/extension/flatpak yang dihapus.

## Approaches

- **Strip**: hapus langsung `desktop/`, `extension/`, `flatpak/`, workspaces,
  script `web`, job CI terkait; script `ios` tetap. (Alternatif: biarkan
  folder, matikan CI — ditolak karena tujuan user justru kesederhanaan.)
- **SponsorBlock kategori**: param `categories=[...]` ke
  `sponsor.ajay.app/api/skipSegments`. (Alternatif: filter lokal semua segmen —
  ditolak, boros bandwidth dan API mendukung param-nya.)
- **Country**: rewrite body POST `/youtubei/*` → `context.client.gl=<ISO>`
  di hook fetch/XHR `content/intercept.ts` (hook sudah ada), + append `gl=`
  pada URL load pertama. (Alternatif: PREF cookie — tidak reliable.)
- **C-lite**: set `ui$.settingsModalOpen = true` sekali per launch di mount
  `MainPage`, skip jika ada deep link/share masuk. (Alternatif C-full hub
  screen — ditunda, lihat hasil C-lite.)

## Keputusan (panggilan saya, koreksi kalau salah)

- Default kategori SponsorBlock: `sponsor`, `selfpromo`, `interaction`
  (paritas dengan perilaku lama terdekat; lama: semua kategori default API).
- Setelan baru di `SettingsSnapshot` + `normalizeSettings`:
  `sponsorBlockCategories: string[]`, `contentCountry: string | null`,
  `openSettingsOnLaunch: boolean` (default **true**).
- Settings mengalir ke webview lewat jalur yang sudah ada
  (`MainPageContent` → `localStorage['nou:settings']` + `window.NouTube.setSettings`).
- UI country: picker teks ISO sederhana (input 2 huruf), bukan daftar 100+ negara.
- Strip dikerjakan di branch `android-only`, commit terpisah per item.

## Sisa untuk builder

- Widget checkbox kategori + validasi ISO di `SettingsModalTabSettings.tsx`.
- Nilai `gl` juga perlu dipakai ulang saat webview reload (cek
  `MainPageContent` inject ulang `nou:settings`).
- Uji: segmen kategori non-aktif tetap muncul di progress bar hanya jika
  kategori aktif (filter di `getSkipSegments`).
