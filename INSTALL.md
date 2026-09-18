# Installing Atmosphere desktop

Official desktop releases are published at:

<https://github.com/yessur3808/atmosphere/releases/latest>

Atmosphere currently publishes preview installers built by GitHub Actions. They are not yet backed by commercial Apple or Windows code-signing certificates. Operating systems can therefore display an unidentified-developer or SmartScreen warning. Do not bypass a warning for a file obtained anywhere other than the official release page.

## Windows

Download the x64 `.exe` NSIS installer from the latest release. Open it and follow the setup prompts. If Microsoft Defender SmartScreen appears, confirm that the publisher is unknown only because the preview is unsigned, verify the checksum and provenance below, and proceed only if the file came from the official repository.

## macOS

Choose the Apple Silicon `aarch64` `.dmg` for M1 or newer Macs, or the `x86_64` `.dmg` for Intel Macs. Drag Atmosphere to Applications. Preview builds use an ad-hoc signature and are not notarized, so macOS may require **System Settings → Privacy & Security → Open Anyway** after the first launch.

## Linux

Use the `.deb` package on Debian or Ubuntu, or the `.AppImage` on other common x64 distributions. For an AppImage:

```sh
chmod +x Atmosphere*.AppImage
./Atmosphere*.AppImage
```

Linux requires a WebKitGTK-compatible desktop environment. Distribution-specific library requirements may apply.

## Verify a download

Each platform job uploads a `checksums-*.txt` file. Compare the listed SHA-256 digest with the downloaded installer.

macOS or Linux:

```sh
shasum -a 256 Atmosphere_*
```

Windows PowerShell:

```powershell
Get-FileHash .\Atmosphere_* -Algorithm SHA256
```

GitHub also publishes a build-provenance attestation. With GitHub CLI installed:

```sh
gh attestation verify ./Atmosphere_* --repo yessur3808/atmosphere
```

## Web version

No installation is required: <https://yessur3808.github.io/atmosphere/>. The web and desktop versions use the same interface; the current desktop shell streams its media library from the public HTTPS deployment.

## Build from source

Install Node.js 22+, Rust stable, and the Tauri 2 prerequisites for the platform, then run:

```sh
git clone https://github.com/yessur3808/atmosphere.git
cd atmosphere
npm ci
npm run check
npm run check:desktop
npm run tauri build
```

Source builds are unofficial and must not be represented as an official Atmosphere release.
