# Security Policy

## Supported versions

Security fixes are applied to the latest code on the `main` branch and to the
newest published release of the Android APK.

| Version | Supported |
| --- | --- |
| Latest `main` / newest APK release | ✅ |
| Older APK builds | ❌ Please update to the newest build |

## Reporting a vulnerability

If you discover a security vulnerability, please report it **privately** rather
than opening a public issue:

1. Use GitHub's **Private vulnerability reporting** for this repository
   (*Security* tab → *Report a vulnerability*). This keeps the details visible
   only to the maintainers.
2. If that channel is unavailable, open a regular issue titled
   `[SECURITY] <short description>` **without** including exploit details, and
   ask to be contacted privately — maintainers will follow up to arrange a
   secure exchange of details.

Please include in your report:

- The affected surface (website, Android APK, sync backend) and its version
- A clear description of the issue and its potential impact
- Steps to reproduce, including any proof-of-concept code or requests
- Any suggested remediation, if you have one

## What to expect

- **Acknowledgement** within 7 days of your report
- An initial assessment and triage decision within 14 days
- Coordinated disclosure: please allow maintainers a reasonable window to fix
  the issue before publishing details, and let us know if it is being actively
  exploited
- Credit in the fix announcement if you wish to be named (reporting
  anonymously is equally welcome)

## Scope

In scope:

- The website hosted at `https://ahmedalmeligy.github.io/principal-attendance-app/`
- The Android application (`com.hadir.attendance`)
- Client-side data handling, authentication, biometric unlock and export/share
  flows

Out of scope:

- Denial-of-service against GitHub Pages infrastructure
- Vulnerabilities in third-party dependencies already tracked by Dependabot
  (a private report is still appreciated for actively exploited issues)
- Social-engineering of individual users or physical attacks

## Notes on the current architecture

This is a client-side application: attendance data, settings and images are
stored on the device (IndexedDB/localStorage) and synchronised through the
configured backend. There is no server-side secret in the repository, and the
production build ships without source maps. Reports of data-leak or
cross-origin issues in this model are especially welcome.
