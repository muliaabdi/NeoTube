# Contributing to NeoTube

Thank you for your interest in contributing to NeoTube!

NeoTube is an open-source, mobile-first, distraction-free YouTube and YouTube Music client.

---

## Code of Conduct & Principles

1. **Lightweight & Fast:** The best code is the code never written. Keep additions minimal, clean, and well-scoped.
2. **Privacy First:** Never log, track, or transmit user data without explicit local control.
3. **Open Standards:** Adhere strictly to AGPLv3 guidelines.

---

## Development Workflow

1. Fork or clone the repository:
   ```bash
   git clone https://github.com/muliaabdi/neotube.git
   cd neotube
   ```
2. Install dependencies:
   ```bash
   bun install
   ```
3. Run tests:
   ```bash
   bun test
   ```
4. Start Metro bundler:
   ```bash
   bun run start
   ```

---

## Pull Request Guidelines

- Ensure `bun test` passes before submitting.
- Avoid introducing unnecessary third-party packages if native web APIs or standard libraries suffice.
- Keep commits concise, following conventional commit formats.

---

## Authors & Contributors

- **NeoTube Maintainer:** [muliaabdi](https://github.com/muliaabdi)
- **Original Project & Inspiration:** [rnons](https://github.com/rnons) and [NouTube contributors](https://github.com/nonbili/NouTube).
