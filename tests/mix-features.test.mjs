import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/App.svelte", import.meta.url), "utf8");
const backgroundSource = await readFile(new URL("../src/components/Background.svelte", import.meta.url), "utf8");
const miniPlayerSource = await readFile(new URL("../src/miniPlayer.js", import.meta.url), "utf8");

test("individual audio layers use dedicated gain nodes and accessible sliders", () => {
  assert.match(appSource, /audioContext\.createGain\(\)/);
  assert.match(appSource, /layerGainNodes\[index\] = layerGain/);
  assert.match(appSource, /aria-label={`\$\{track\.title\} layer volume`}/);
  assert.match(appSource, /layer_volume_change/);
});

test("mix persistence, sharing, favorites, history, and resume are wired to versioned storage", () => {
  for (const storageKey of [
    "atmosphere-saved-mixes-v1",
    "atmosphere-recent-mixes-v1",
    "atmosphere-favorite-scenes-v1",
    "atmosphere-resume-v1",
  ]) {
    assert.ok(appSource.includes(storageKey), `${storageKey} is missing`);
  }
  assert.match(appSource, /encodeMixSnapshot/);
  assert.match(appSource, /decodeMixSnapshot/);
  assert.match(appSource, /navigator\.share/);
});

test("Data Saver removes video sources from both the background and mini player", () => {
  assert.match(backgroundSource, /export let disabled = false/);
  assert.match(backgroundSource, /slotSources = \["", ""\]/);
  assert.match(backgroundSource, /element\.removeAttribute\("src"\)/);
  assert.match(miniPlayerSource, /state\.dataSaverMode/);
  assert.match(miniPlayerSource, /miniVideo\.removeAttribute\("src"\)/);
});

test("video backgrounds use two media slots for a real opacity crossfade", () => {
  assert.match(backgroundSource, /const slots = \[0, 1\]/);
  assert.match(backgroundSource, /pendingSlot = activeSource \? 1 - activeSlot : activeSlot/);
  assert.match(backgroundSource, /video\.visible \{ opacity: 1; \}/);
});

test("Smart Mix and library discovery controls are exposed in the interface", () => {
  assert.match(appSource, /smartMixIntervalMilliseconds/);
  assert.match(appSource, /updateSmartMixTargets/);
  assert.match(appSource, /Search atmospheres and sounds/);
  assert.match(appSource, /filterSceneLibrary/);
});
