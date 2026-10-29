# Contributing to حاضر — Principal Attendance

Thank you for your interest in improving this project. Contributions of all
kinds are welcome: bug reports, feature ideas, documentation, translations and
code.

## Getting started

```bash
git clone https://github.com/AhmedAlmeligy/principal-attendance-app.git
cd principal-attendance-app-main
npm install
npm run dev
```

The app runs at `http://localhost:5173` with hot module replacement.

## Development workflow

1. **Fork** the repository and create your branch from `main`:
   ```bash
   git checkout -b fix/short-description
   ```
2. **Make your changes.** Keep pull requests focused — one fix or feature per PR.
3. **Verify your work** before opening a PR:
   ```bash
   npm run lint     # ESLint
   npm run test     # Vitest unit tests
   npm run build    # Production build (tsc + vite build)
   ```
   All three must pass. CI runs the same checks on every pull request.
4. **Commit** with a clear message that explains *why* the change was made:
   ```bash
   git commit -m "fix: describe the problem this solves"
   ```
5. **Open a pull request** and fill in the template.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/pages/` | Route screens (Home, Attendance, Employees, Reports, Settings…) |
| `src/components/` | Reusable UI (Radix-based primitives in `ui/`, app shell in `app/`) |
| `src/lib/` | Domain logic: attendance rules, reports, sync, biometric, WhatsApp |
| `src/providers/` | App state, settings, theme and sync providers |
| `android/` | Native Android shell (WebView wrapper) used to produce the APK |
| `screenshots/` | Images used in the README |

## Design guidelines

- The interface is **Arabic, right-to-left**. Always use logical CSS properties
  (`ms-*`, `me-*`, `ps-*`, `pe-*`) instead of hard-coded left/right.
- Support **both light and dark mode** — no hard-coded white or black surfaces.
- Keep the mobile-first bottom navigation and swipe gestures intact.
- Accessibility: interactive elements need visible labels or `aria-label`.

## Reporting bugs

Use the **Bug report** issue template and include:

- App version and platform (web, Android APK, device + Android version)
- Steps to reproduce and what you expected vs. what happened
- Screenshots or console output when available

## Security issues

**Do not open a public issue for security vulnerabilities.** Follow the
process in [SECURITY.md](SECURITY.md) instead.

## Code of conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you agree to uphold it.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE) that covers this project.
