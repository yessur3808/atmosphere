import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/App.svelte", import.meta.url), "utf8");
const backgroundSource = await readFile(new URL("../src/components/Background.svelte", import.meta.url), "utf8");
const miniPlayerSource = await readFile(new URL("../src/miniPlayer.js", import.meta.url), "utf8");

test("individual audio layers use dedicated gain nodes and accessible sliders", () => {
  assert.match(appSource, /audioContext\.createGain\(\)/);
  assert.match(appSource, /layerGainNodes\[index\] = layerGain/);
  assert.match(appSource, /aria-label={`\$\{(?:entry\.)?track\.title\} layer volume`}/);
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

test("audio pause always rests background motion while separate video pause remains available", () => {
  assert.match(appSource, /function pauseAllAudio\(\)[\s\S]*?isAudioPlaying = false;\s*isVideoPlaying = false;/);
  assert.match(appSource, /if \(!isAudioPlaying\)[\s\S]*?Start the sound before playing background motion/);
});

test("Apple mobile devices do not receive unsupported mini-player controls", () => {
  assert.match(appSource, /function isAppleMobileDevice\(\)/);
  assert.match(appSource, /settingsTabs\.filter\(\(tab\) => tab\.id !== "mini-player"\)/);
  assert.match(appSource, /\{#if pipControlsAvailable\}[\s\S]*?class="pip-control"/);
  assert.match(appSource, /pipPromptVisible && !immersiveMode && \(!analyticsConfigured \|\| analyticsConsent !== "unset"\)/);
});

test("high-density phones and tablets receive full-quality video unless the network is constrained", () => {
  assert.match(backgroundSource, /useAdaptive = forceAdaptive \|\| constrainedNetwork;/);
  assert.doesNotMatch(backgroundSource, /matchMedia\("\(max-width: 720px\)"\)/);
});

test("Smart Mix and library discovery controls are exposed in the interface", () => {
  assert.match(appSource, /smartMixIntervalMilliseconds/);
  assert.match(appSource, /updateSmartMixTargets/);
  assert.match(appSource, /Search atmospheres and sounds/);
  assert.match(appSource, /filterSceneLibrary/);
});

test("mix discovery uses progressive disclosure across desktop and mobile", () => {
  assert.match(appSource, /Now mixing/);
  assert.match(appSource, /mixEditorOpen/);
  assert.match(appSource, /Fine tune/);
  assert.match(appSource, /role="tablist" aria-label="Mix collections"/);
  assert.match(appSource, /For you/);
  assert.match(appSource, /Saved\{savedMixes\.length/);
  assert.match(appSource, /class="mix-drawer-sticky"/);
  assert.match(appSource, /width: min\(720px, calc\(100vw - 116px\)\)/);
  assert.match(appSource, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(appSource, /\.recipe-drawer\.closed \{ transform: translateY\(100%\); \}/);
});

test("mobile prioritizes playback and progressively reveals a modern atmosphere grid", () => {
  assert.match(appSource, /class:expanded=\{libraryExpanded \|\| Boolean\(libraryQuery\) \|\| libraryCategory !== "all"\}/);
  assert.match(appSource, /Show all \$\{filteredScenes\.length\} atmospheres/);
  assert.match(appSource, /\.mixer-panel \{ order: -2; \}/);
  assert.match(appSource, /\.library-panel \{ order: -1; \}/);
  assert.match(appSource, /\.scene-grid:not\(\.expanded\) \.scene-card:nth-child\(n\+9\):not\(\.active\)/);
  assert.match(appSource, /\.recipe-drawer-handle \{ top: -62px;/);
});

test("Live Weather is a first-class, privacy-conscious adaptive atmosphere", () => {
  assert.match(appSource, /Current weather/);
  assert.match(appSource, /weatherAtmosphereProfile/);
  assert.match(appSource, /weather_match_apply/);
  assert.match(appSource, /Mirror outside/);
  assert.match(appSource, /Comforting contrast/);
  assert.match(appSource, /Use another city/);
  assert.match(appSource, /bind:this=\{ambientStatusComponent\}/);
  assert.doesNotMatch(appSource, /weather_(?:match|mode|strength)[^\n]*locationLabel/);
});

test("City Sounds exposes Traffic as a searchable sound subcategory", () => {
  assert.match(appSource, /Choose a sound category/);
  assert.match(appSource, /selectSoundCategory/);
  assert.match(appSource, /sound_subcategory_select/);
  assert.match(appSource, /visibleAudioTracks/);
  assert.match(appSource, /visibleVideoLoops/);
});

test("Hotel Lobby targets elevator music without stacking several instrumentals", () => {
  assert.match(
    appSource,
    /id: "hotel-lobby".*sceneId: "tab_elevator_music".*indices: \[0, 5\].*volumes: \[0\.78, 0\.24\]/,
  );
  assert.match(appSource, /recipe\.sceneId \|\| activeScene\.id !== "tab_elevator_music"/);
});

test("the curated recipe collection includes every recommended cross-purpose mix", () => {
  for (const recipeId of [
    "cozy-cabin",
    "midnight-reading",
    "rainy-commute",
    "deep-office-focus",
    "forest-stream",
    "storm-watching",
    "spa-retreat",
    "cat-nap",
  ]) {
    assert.ok(appSource.includes(`id: "${recipeId}"`), `${recipeId} recipe is missing`);
  }
});
