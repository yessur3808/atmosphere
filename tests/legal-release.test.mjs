import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const rootDocuments = ["LICENSE", "NOTICE", "PRIVACY.md", "TERMS.md", "COOKIES.md", "SECURITY.md", "ACCESSIBILITY.md", "INSTALL.md", "THIRD_PARTY_NOTICES.md", "THIRD_PARTY_LICENSES.json", "MEDIA_LICENSES.json"];
const publicDocuments = ["legal.html", "privacy.html", "cookies.html", "analytics.html", "terms.html", "install.html", "security.html", "licenses.html", "accessibility.html", "legal.css"];

test("release and legal documents are present and complete", async () => {
  await Promise.all([...rootDocuments, ...publicDocuments.map((file) => `public/${file}`)].map((file) => access(path.join(projectRoot, file))));
  const combined = (await Promise.all(rootDocuments.map((file) => readFile(path.join(projectRoot, file), "utf8")))).join("\n");
  assert.doesNotMatch(combined, /TODO|TBD|G-XXXXXXXXXX|example\.com/i);
  assert.match(combined, /yessur3808\/atmosphere/);
  assert.match(combined, /27 September 2026/);
  assert.doesNotMatch(combined, /releases\/latest/);
  assert.match(await readFile(path.join(projectRoot, "public/install.html"), "utf8"), /Atmosphere_1\.0\.0_x64-setup\.exe/);
});

test("the media license register covers every active audio and video item", async () => {
  const [register, audioSources, videoSources] = await Promise.all([
    readFile(path.join(projectRoot, "MEDIA_LICENSES.json"), "utf8").then(JSON.parse),
    readFile(path.join(projectRoot, "public/assets/audio/SOURCES.json"), "utf8").then(JSON.parse),
    readFile(path.join(projectRoot, "src/videoLoops.resolved.json"), "utf8").then(JSON.parse),
  ]);
  const activeVideo = Object.values(videoSources).flat();
  assert.equal(register.audio.length, audioSources.length);
  assert.equal(register.video.length, activeVideo.length);
  assert.ok([...register.audio, ...register.video].every(({ status, sourcePage, license, creator }) => status === "cleared" && sourcePage && license && creator));
  assert.ok(register.audio.every(({ delivery }) => delivery.some(({ quality }) => quality === "full") && delivery.some(({ quality }) => quality === "balanced")));
  assert.ok(register.video.every(({ delivery }) => delivery.some(({ quality }) => quality === "full") && delivery.some(({ quality }) => quality === "balanced")));
  assert.deepEqual(new Set(register.video.map(({ sourcePage }) => sourcePage)), new Set(activeVideo.map(({ source }) => source)));
});

test("desktop release workflow packages every supported platform securely", async () => {
  const workflow = await readFile(path.join(projectRoot, ".github/workflows/release.yml"), "utf8");
  for (const marker of ["windows-latest", "macos-latest", "ubuntu-22.04", "tauri-apps/tauri-action@v0.6.2", "actions/attest@v4", "checksums-"]) {
    assert.ok(workflow.includes(marker), `release workflow is missing ${marker}`);
  }
  assert.match(workflow, /prerelease: true/);
  assert.match(workflow, /APPLE_SIGNING_IDENTITY/);
});

test("security automation covers analysis, audits, review, and updates", async () => {
  const [workflow, dependabot] = await Promise.all([
    readFile(path.join(projectRoot, ".github/workflows/security.yml"), "utf8"),
    readFile(path.join(projectRoot, ".github/dependabot.yml"), "utf8"),
  ]);
  for (const marker of ["codeql-action/init@v4", "cargo audit", "npm audit", "dependency-review-action@v4"]) assert.ok(workflow.includes(marker));
  for (const ecosystem of ["npm", "cargo", "github-actions"]) assert.ok(dependabot.includes(`package-ecosystem: ${ecosystem}`));
});
