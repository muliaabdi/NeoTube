# Playback lokal dari hasil download — design

Tanggal: 2026-11-10
Status: menunggu persetujuan akhir

## Intent

Video yang sudah di-download lewat yt-dlp otomatis diputar dari file lokal saat
watch page-nya dibuka lagi: player YouTube di page ditimpa overlay `<video>`.
Tujuan: hemat kuota, tanpa iklan/buffering, siap offline. Halaman tetap YouTube
penuh — komentar, rekomendasi, layout, sticky player tidak berubah.

## Goals

1. Trigger otomatis: buka watch page yang punya copy lokal (indeks hit + file
   masih ada) → overlay video lokal aktif.
2. Satu implementasi content script untuk Android dan desktop.
3. Kontrol minimal di overlay: play/pause, seek, kecepatan, tombol "putar dari
   YouTube" (kembali ke streaming).

## Non-goals

- Subtitle/captions (jalur upgrade: `--write-subs` + render `.vtt` sendiri).
- Ganti kualitas on-the-fly (terkunci ke format yang didownload).
- Integrasi media notification `NouService` untuk playback lokal (v1).
- Sinkronisasi progres ke akun YouTube — disetujui tidak diperlukan; watch
  history internal NouTube tetap dicatat.
- iOS (tanpa yt-dlp; bridge selalu menjawab tidak ada file).
- `/shorts` dan embed modal — v1 hanya `/watch`; Shorts tetap streaming
  biasa (tidak ada rect `#movie_player` untuk ditimpa).
- Autoplay/playlist tidak berlanjut setelah file lokal selesai (`ended` =
  berhenti + tombol replay).
- Backfill library lama — indeks hanya diisi mulai download berikutnya;
  file yang sudah ada hari ini tidak terdeteksi. Backfill Android masih
  mungkin ditambah belakangan lewat state download persisten (`savedPath`).

## Approaches

- **A (dipilih) — overlay dalam webview**: content script inject `<video>`
  menimpa rect `#movie_player`, file dilayani dari origin virtual via
  intercept request yang sudah ada di kedua platform. Pola kontrol ikut
  `content/fullscreen-controls.ts`.
- **B — player native overlay RN**: ditolak. Harus sync rect saat
  scroll/sticky player, merombak `PlayerFrame` (split-view/mini-player
  mengasumsikan webview adalah player-nya), dan desktop butuh implementasi
  terpisah.
- **C — fallback-only** (lokal hanya saat streaming gagal): ditolak, bukan
  fitur yang diminta.

## Keputusan (panggilan saya, koreksi kalau salah)

1. **Indeks download persisten** (prasyarat — hari ini tidak ada yang
   menghubungkan videoId dengan file):
   - Entry ditulis saat download selesai, dari sisi yang mengelola hasilnya:
     Android di RN (`main-client.downloadVideo` resolve `savedUri` MediaStore;
     tipe kini `Promise<void>` — diubah agar resolve hasil), desktop di
     renderer ToolsModal (path output sudah diketahui IPC).
   - Bentuk: `{ videoId, formatId, title, uri (Android) / path (desktop),
     completedAt }`, key `videoId`, disimpan `nou:downloads-index`
     (Android: AsyncStorage, desktop: localStorage renderer).
   - Template nama file TIDAK diubah (tetap tanpa `%(id)s`); indeks jadi
     sumber tunggal. Lookup selalu cek eksistensi file; file hilang → jawab
     tidak ada → streaming normal, entry indeks dibuang.
2. **Serving file**: origin virtual satu untuk dua platform,
   `https://noutube-assets.local/downloads/<videoId>`.
   - Android: `shouldInterceptRequest` di `NouWebView` membuka stream
     MediaStore, wajib dukung `Range` (206 partial) supaya seek jalan.
   - Desktop: served dari `interceptHttpRequest` yang sudah ada, stream file
     + range.
3. **Bridge lookup**: fungsi baru via pola eval/`NouTubeI` yang sudah ada:
   `localVideoUrl(videoId) -> string | null` (URL origin virtual, atau null).
4. **Overlay**: `<video>` absolute pada rect `#movie_player`, bg hitam,
   `object-fit: contain`; player YouTube di-pause + di-mute saat aktif dan
   dikembalikan saat kembali ke streaming / navigasi. Kontrol: tap
   play/pause, seekbar + waktu, menu speed, tombol "putar dari YouTube",
   autohide. Navigasi SPA (`yt-navigate-finish`, `popstate`) membersihkan
   overlay.
5. **Split-view / mini / PiP**: `PlayerFrame` tetap membungkus webview yang
   sama sehingga overlay ikut otomatis. `reportPictureInPictureVideo`
   (`content/picture-in-picture.ts`) diarahkan memilih video overlay saat
   aktif — `document.querySelector('video')` pertama adalah video YouTube.
6. **History internal**: dicatat saat mulai play lokal dan posisinya
   diperbarui lewat hook pencatat history yang ada (ref: commit "Fix watch
   history recording across player transitions").
7. **Settings**: toggle `localPlayback` default ON (`SettingsSnapshot` +
   `normalizeSettings` + baris di `SettingsModalTabSettings`), mengalir ke
   webview lewat jalur setting yang ada (`nou:settings`).
8. **Indeks hidup di sisi penyaji file** (hasil builder check): snapshot
   indeks di-push ke modul Kotlin dan Electron main saat startup + tiap
   download selesai, karena `shouldInterceptRequest`/intercept desktop
   tidak bisa membaca AsyncStorage/localStorage; pengecekan eksistensi file
   (query MediaStore / `fs.exists`) dilakukan di sana. Bridge desktop
   memang async (`sendToHost` round-trip) — content script meng-handle
   async.
9. **Download audio-only tidak memicu overlay**; indeks menandai
   `audioOnly`. Beberapa entri untuk satu videoId: tulisan terakhir menang.
10. **Mulai dari posisi watch history internal** (continue-watching), bukan
    dari 0.
11. **Player YouTube dikunci total saat overlay aktif**: pause + mute, dan
    media notification / background-guard / `window.NouTube.play()` tidak
    boleh men-resume-nya (mencegah streaming senyap yang justru memakai
    kuota). Saat `ended`: berhenti, tampilkan replay.

## Sisa untuk builder

- Implementasi `Range`/206 di `WebResourceResponse` Android (slice stream
  sesuai header; `video/mp4` dari ekstensi, fallback `application/octet-stream`).
- Desktop: path file hasil yt-dlp diambil dari `--print after_move:filepath`
  (atau parse final line) — sekarang `downloadVideo` di main tidak
  mengembalikannya.
- Perubahan tipe `downloadVideo` resolve (uri/path) harus tetap aman dipakai
  ToolsModal yang sekarang mengabaikan hasil.
- Uji manual: seek bekerja di Android (range), file terhapus → fallback diam
  ke streaming, overlay bersih saat navigasi SPA, PiP memakai video overlay.
