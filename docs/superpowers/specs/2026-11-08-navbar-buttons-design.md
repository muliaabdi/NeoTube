# Navbar buttons (pengganti toolbar) — design

## Intent
Header app tidak dirender di Android (`showHeader: false` default), jadi tombol
Back/Forward/Reload/Home/History/Library/Star dan entry **Settings** tidak
terjangkau. Section Settings "Toolbar buttons" jadi mati. Tombol-tombol ini
dipindah ke kolom yang disuntikkan ke halaman YouTube, menempel di atas navbar
vertikal (`vertical-navbar` user style) di tepi kanan.

## Goals
- Akses satu-tap: Settings, History, Library (buka modal app), Back/Forward/
  Reload/Home (navigasi halaman), Star (bookmark video aktif).
- Toggle lama `showXButtonInHeader` dipakai ulang sebagai saklar tiap tombol.
- Tampil menyatu dengan navbar vertikal (pill gelap, blur, kanan).

## Non-goals
- Sleep timer button (dukungan native Android tidak ada).
- Queue / PiP / playback-speed pill (butuh state app; bisa menyusul).
- Desktop/web UI — fork ini mobile-only.

## Cara kerja
1. **Config ke halaman**: snapshot settings yang sudah ada
   (`getContentSettingsSnapshot`) ditambah field `navbarButtons:
   {back, forward, reload, home, history, library, star}`; ikut otomatis lewat
   prelude + `setSettings` saat toggle berubah.
2. **Content script** `content/navbar.ts`: kolom `div` fixed `right:0;
   bottom:55%` (tumbuh ke atas, menempel zona navbar yang berpusat di 50%).
   Ikon SVG inline, styling meng-imitasi CSS `vertical-navbar`
   (rgba gelap + blur + border-radius kiri). Tombol Settings selalu tampil;
   tombol lain sesuai flag. Guard re-render YouTube: observer sederhana yang
   memasang ulang node bila dilepas.
3. **Aksi**:
   - Navigasi (back/forward/reload/home): `history.back()` / `forward()` /
     `location.reload()` / `location.assign('https://m.youtube.com/')` di halaman.
   - Modal app (history/library/settings): `emit('navbar-action',
     {action:'history'|'library'|'settings'})` -> case baru di `onMessage`
     MainPageContent yang membuka modal terkait.
   - Star: ambil video aktif dari `window.NouTube.getVideoUrl()` ->
     `emit('star', {title, url})` (handler sudah ada).
4. **Settings UI**: section "Toolbar buttons" diganti label "Navbar buttons"
   (en/id) + label per-tombol "di toolbar" -> "di navbar". Tanpa key baru.

## Approaches yang dipertimbangkan
- **Suntik ke webview (dipilih)**: menyatu dengan navbar vertikal pilihan
  user; bridge sudah ada. Risiko: YouTube re-render — diatasi observer.
- Kolom native RN di tepi kanan: tanpa risiko DOM, tapi bar kedua terpisah
  dari navbar YouTube; overlay menutup konten.
- Hapus section setting saja: termurah, tapi akses Settings/History hilang.

## Dibusangkan
- Sleep timer, queue, PiP, pill speed/quality — tambah bila diminta.
