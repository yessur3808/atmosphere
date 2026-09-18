# Atmosphere

Atmosphere is an ambient sound and cinematic video player for focus, reading, relaxation, and sleep. The same Svelte interface runs on the web and inside a Tauri 2 desktop shell for Windows, macOS, and Linux.

## Use Atmosphere

- [Launch the web app](https://yessur3808.github.io/atmosphere/)
- [Download the latest desktop release](https://github.com/yessur3808/atmosphere/releases/latest)
- [Desktop installation guide](https://yessur3808.github.io/atmosphere/install.html)
- [Report a problem](https://github.com/yessur3808/atmosphere/issues)

Desktop installers are generated from tagged commits by GitHub Actions. Read [INSTALL.md](INSTALL.md) before installing an unsigned preview build.

## Features

- 22 audited atmosphere themes with five audio choices and four video loops each
- Layered sound mixing with independent volumes, smooth crossfades, Smart Mix, saved mixes, favorites, shareable mixes, and resume history
- Linked or separate audio/video playback, audio-only data saver mode, quiet view, and a mini player
- Optional local weather and consent-gated Google Analytics
- Responsive glass interface for desktop, tablet, and mobile
- Native Tauri tray controls and single-instance behavior

## Local web development

Requirements: Node.js 22 or later and npm.

```sh
npm ci
npm run dev
```

The production server listens on all interfaces when started with an explicit port:

```sh
npm run build
npm start -- --port 4173
```

## Desktop development

Install the platform prerequisites listed by Tauri, then run:

```sh
npm ci
npm run tauri dev
```

See [DESKTOP.md](DESKTOP.md) for the native architecture and [INSTALL.md](INSTALL.md) for packaged-app instructions.

## Quality and security

```sh
npm run check
npm run check:desktop
```

The repository also runs CodeQL, dependency review, npm and Rust vulnerability audits, Dependabot updates, cross-platform native builds, release checksums, and GitHub artifact attestations. See [SECURITY.md](SECURITY.md) for reporting and supported versions.

## Policies and licensing

- [Privacy policy](PRIVACY.md)
- [Terms of use](TERMS.md)
- [Security policy](SECURITY.md)
- [Accessibility statement](ACCESSIBILITY.md)
- [Software license](LICENSE)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Audio credits](https://yessur3808.github.io/atmosphere/audio-credits.html)
- [Video credits](https://yessur3808.github.io/atmosphere/video-credits.html)

Atmosphere's original source code and brand assets are source-available and all rights reserved unless a file says otherwise. Third-party software and media remain under their respective licenses.
