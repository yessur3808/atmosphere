import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Tauri desktop shell is configured as a thin native package", async () => {
  const [configText, packageText, cargoText] = await Promise.all([
    read("src-tauri/tauri.conf.json"),
    read("package.json"),
    read("src-tauri/Cargo.toml"),
  ]);
  const config = JSON.parse(configText);
  const packageJson = JSON.parse(packageText);

  assert.equal(config.build.frontendDist, "../desktop-dist");
  assert.equal(config.identifier, "com.atmosphere.desktop");
  assert.equal(config.bundle.licenseFile, "../TERMS.md");
  assert.equal(config.bundle.windows.allowDowngrades, false);
  assert.equal(packageJson.scripts.tauri, "tauri");
  assert.equal(packageJson.scripts["release:verify"], "node scripts/verify-release-version.mjs");
  assert.match(cargoText, /features = \["tray-icon"\]/);
  assert.match(cargoText, /tauri-plugin-single-instance/);
});

test("desktop runtime exposes native tray transport and cross-origin media safely", async () => {
  const [app, bridge, background] = await Promise.all([
    read("src/App.svelte"),
    read("src/desktopRuntime.js"),
    read("src/components/Background.svelte"),
  ]);

  assert.match(app, /crossorigin="anonymous"/);
  assert.match(app, /desktop_tray/);
  assert.match(bridge, /atmosphere:\/\/toggle-playback/);
  assert.match(background, /mediaUrl/);
});
