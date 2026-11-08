# Remove TOOLBAR Section from Appearance — Design

Date: 2026-11-08 · Status: approved (user picked option 2 after menu)

## Intent
Settings -> Appearance -> section "Toolbar" dihapus: pengaturan posisi (atas/bawah), double-tap sembunyi, auto-hide arah scroll, dan sembunyi-saat-scroll mengontrol app bar (`NouHeader`) yang default tersembunyi di fork mobile ini — jarang relevan, bikin Settings bising.

## Keputusan
- Row "Vertical navbar on right" (fitur navbar kita) PINDAH ke section "NAVBAR BUTTONS" (row pertama), tidak ikut terhapus.
- Toggle on/off app bar (`showHeader`, SettingsModalTabSettings:654) tetap ada. Perilaku app bar jadi fixed sesuai nilai tersimpan/default.
- State settings (`headerPosition`, `doubleTapToToggleHeader`, `autoHideHeader`, `hideToolbarWhenScrolled`) TIDAK dihapus — hanya UI-nya; sync ke webview tetap jalan. Bedah state = churn tanpa manfaat.
- Locale keys lama dibiarkan (orphan, 16 file; kebijakan repo en/id saja).

## Approaches
- Hapus section + pindah row verticalNavbar — dipilih.
- Hapus app bar total — ditolak (kehilangan pill rate/quality + tabs).
- Biarkan — ditolak user.

## Verifikasi
Suite + bundle + device (bergabung dengan Task 5 update-check: satu build, cek Settings Appearance tidak ada lagi "TOOLBAR", NAVBAR BUTTONS berisi row Vertical navbar).
