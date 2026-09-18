# Atmosphere desktop

Atmosphere desktop uses Tauri 2 around the existing Svelte interface. The first desktop milestone intentionally ships a thin application shell: audio and video stream from the public HTTPS media library, while the complete media collection remains outside the installer. Native resumable downloads will be added as a separate storage layer.

## Development

Install the platform prerequisites from the Tauri 2 documentation, then run:

```sh
npm ci
npm run tauri dev
```

The development shell uses `http://localhost:5173`. The production build creates a filtered `desktop-dist/` containing only the application shell and then compiles it with Tauri:

```sh
npm run check:desktop
npm run tauri build
```

## Included in this milestone

- macOS, Windows, and Linux Tauri configuration
- a small shell that excludes the large media library
- secure Content Security Policy for the known media and weather origins
- single-instance behavior
- tray actions for opening Atmosphere, toggling playback, and quitting
- native app icons and minimum window sizing
- cross-platform GitHub Actions compile checks

Code signing, notarization, native offline downloads, media-key integration, and release publishing require platform credentials or the next native implementation phase.
