import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const desktopRoot = path.join(projectRoot, "desktop-dist");
const tauriRoot = path.join(projectRoot, "src-tauri");
const config = JSON.parse(await readFile(path.join(tauriRoot, "tauri.conf.json"), "utf8"));

assert.equal(config.build.frontendDist, "../desktop-dist");
assert.equal(config.identifier, "com.atmosphere.desktop");
assert.equal(config.app.windows[0].label, "main");
assert.match(config.app.security.csp, /default-src 'self'/);
assert.match(config.app.security.csp, /media-src/);

for (const file of ["index.html", "global.css", "site.webmanifest", "build/bundle.js", "build/bundle.css"]) {
  await access(path.join(desktopRoot, file));
}

const entries = await readdir(desktopRoot);
assert.ok(!entries.includes("assets"), "desktop shell must not embed the full media library");
const bundleBytes = (await stat(path.join(desktopRoot, "build/bundle.js"))).size;
assert.ok(bundleBytes < 350_000, "desktop JavaScript bundle exceeded the 350 KB guardrail");

console.log(JSON.stringify({ status: "ok", identifier: config.identifier, bundleBytes, embeddedMedia: false }, null, 2));
