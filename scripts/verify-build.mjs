import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(projectRoot, "public");
const requiredFiles = [
  "index.html",
  ".nojekyll",
  "global.css",
  "site.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "legal.css",
  "legal.html",
  "privacy.html",
  "terms.html",
  "install.html",
  "security.html",
  "licenses.html",
  "accessibility.html",
  "build/bundle.js",
  "build/bundle.css",
];

for (const file of requiredFiles) await access(path.join(publicRoot, file));

const html = await readFile(path.join(publicRoot, "index.html"), "utf8");
const bundle = await readFile(path.join(publicRoot, "build/bundle.js"), "utf8");
const styles = await readFile(path.join(publicRoot, "build/bundle.css"), "utf8");
const searchable = `${html}\n${bundle}\n${styles}`;

assert.doesNotMatch(searchable, /100\.104\.252\.183/);
for (const marker of [
  "Japanese onsen",
  "Cat by the window",
  "Quiet library",
  "Beach / shore",
  "tab_traffic",
  "Elevator music",
  "tab_elevator_music",
  "Hotel lobby",
  "onsen-rise",
  "traffic-move",
  "elevator-rise",
  "Rainy bedroom",
  "Brown noise",
  "Spaceship observation deck",
  "Night drive",
  "City apartment at night",
  "tab_farm",
  "Cozy cabin",
  "Midnight reading",
  "deep-office-focus",
  "space-orbit",
  "farm-turn",
]) {
  assert.ok(searchable.includes(marker), `production build is missing ${marker}`);
}

const bundleSize = (await stat(path.join(publicRoot, "build/bundle.js"))).size;
assert.ok(bundleSize > 50_000, "production JavaScript bundle is unexpectedly small");
assert.ok(bundleSize < 300_000, "production JavaScript bundle exceeded the 300 KB guardrail");

console.log(JSON.stringify({
  status: "ok",
  deploymentBase: "https://yessur3808.github.io/atmosphere/",
  requiredFiles: requiredFiles.length,
  bundleBytes: bundleSize,
}, null, 2));
