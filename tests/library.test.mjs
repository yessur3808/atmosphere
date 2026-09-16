import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(projectRoot, "public");
const tabs = JSON.parse(await readFile(path.join(projectRoot, "src/tabsData.json"), "utf8"));
const audioSources = JSON.parse(await readFile(path.join(projectRoot, "audio-sources.json"), "utf8"));
const videoSources = JSON.parse(await readFile(path.join(projectRoot, "src/videoLoops.resolved.json"), "utf8"));
const remoteFirstScenes = new Set([
  "tab_foot_steps",
  "tab_onsen",
  "tab_cat_window",
  "tab_library",
  "tab_forest",
  "tab_jungle",
  "tab_beach_shore",
  "tab_traffic",
]);

function publicPath(urlPath) {
  return path.join(publicRoot, urlPath.replace(/^\/+/, ""));
}

test("the atmosphere catalog is complete and has unique scene IDs", () => {
  assert.equal(tabs.length, 22);
  assert.equal(new Set(tabs.map(({ id }) => id)).size, tabs.length);
  assert.deepEqual(Object.keys(audioSources).sort(), tabs.map(({ id }) => id).sort());
  assert.deepEqual(Object.keys(videoSources).sort(), tabs.map(({ id }) => id).sort());
});

test("every atmosphere exposes five playable audio choices", async () => {
  let choiceCount = 0;
  const uniqueFiles = new Set();

  for (const scene of tabs) {
    const tracks = audioSources[scene.id];
    assert.equal(tracks.length, 5, `${scene.id} should have five audio choices`);
    choiceCount += tracks.length;

    for (const track of tracks) {
      const source = track.src || `assets/audio/${scene.id.replace(/^tab_/, "")}/${track.file}`;
      assert.ok(!/^https?:/i.test(source), `${scene.id}/${track.title} should use locally controlled audio`);
      uniqueFiles.add(source.replace(/^\/+/, ""));
      await access(publicPath(source));
    }
  }

  assert.equal(choiceCount, 110);
  assert.equal(uniqueFiles.size, 77);
});

test("every atmosphere exposes four distinct video loops and a local poster", async () => {
  let loopCount = 0;

  for (const scene of tabs) {
    const loops = videoSources[scene.id];
    const renderedLoopCount = loops.length + (remoteFirstScenes.has(scene.id) ? 0 : 1);
    assert.equal(renderedLoopCount, 4, `${scene.id} should render four video loops`);
    loopCount += renderedLoopCount;

    assert.equal(new Set(loops.map(({ high }) => high)).size, loops.length, `${scene.id} should not repeat 1080p loops`);
    for (const loop of loops) {
      assert.match(loop.high, /^https:\/\/cdn\.coverr\.co\/.+\/1080p\.mp4$/);
      assert.match(loop.adaptive, /^https:\/\/cdn\.coverr\.co\/.+\/720p\.mp4$/);
      assert.match(loop.source, /^https:\/\/coverr\.co\/videos\//);
    }

    const mediaName = scene.background.replace(/\.[^.]+$/, "");
    await access(path.join(publicRoot, "assets/videos/posters", `${mediaName}.jpg`));
    if (!remoteFirstScenes.has(scene.id)) {
      await access(path.join(publicRoot, "assets/videos", scene.background));
      await access(path.join(publicRoot, "assets/videos/adaptive", `${mediaName}-720.mp4`));
    }
  }

  assert.equal(loopCount, 88);
});

test("all published media files remain within GitHub's per-file limit", async () => {
  const maximumFileBytes = 100 * 1024 * 1024;
  const folders = [path.join(publicRoot, "assets/audio"), path.join(publicRoot, "assets/videos")];
  const pending = [...folders];

  while (pending.length) {
    const current = pending.pop();
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      if (entry.isFile()) {
        const details = await stat(target);
        assert.ok(details.size < maximumFileBytes, `${path.relative(projectRoot, target)} exceeds 100 MB`);
      }
    }
  }
});
