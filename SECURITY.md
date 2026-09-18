# Security policy

## Supported versions

Only the latest published desktop release and the current web deployment receive security fixes. Development snapshots and older releases are unsupported.

## Report a vulnerability privately

Do not open a public issue for a suspected vulnerability or expose user data, credentials, exploit details, or private links.

1. Open the repository's **Security** tab and choose **Report a vulnerability**, or visit <https://github.com/yessur3808/atmosphere/security/advisories/new>.
2. Include the affected version or URL, platform, reproduction steps, impact, and any suggested remediation.
3. If private vulnerability reporting is unavailable, open a public issue containing no vulnerability details and request a private contact channel.

The maintainers aim to acknowledge reports within seven days, provide an initial assessment within fourteen days, and coordinate disclosure after a fix is available. These are targets, not guarantees.

## Security design

- The desktop shell uses a narrow Tauri capability set and an explicit Content Security Policy.
- Remote content is restricted to the documented GitHub Pages, weather, analytics, and media origins.
- Analytics is consent-gated; advertising storage and personalization are disabled.
- GitHub Actions runs CodeQL, dependency review, npm and Rust audits, linting, tests, and cross-platform native compilation.
- Dependabot tracks npm, Cargo, and GitHub Actions dependencies.
- Release artifacts include SHA-256 checksums and GitHub build-provenance attestations.

Build provenance does not prove that software is free of vulnerabilities. Download only from <https://github.com/yessur3808/atmosphere/releases> and verify the release as described in [INSTALL.md](INSTALL.md).

## Out of scope

Automated scans and good-faith research are welcome when they avoid privacy violations, data destruction, denial of service, social engineering, physical attacks, and testing third-party infrastructure without permission. Reports that concern GitHub, Google, Open-Meteo, Coverr, a browser, or an operating-system WebView should also be reported to the affected provider.
