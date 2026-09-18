import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeMixSnapshot,
  encodeMixSnapshot,
  filterSceneLibrary,
  normalizeMixSnapshot,
  sortSavedMixes,
  upsertRecentMix,
} from "../src/mixState.mjs";

const scenes = [
  {
    id: "rain",
    title: "Rain",
    category: "Weather",
    description: "Rain on a window",
    audioTracks: [
      { id: "rain-soft", title: "Soft rain", note: "Window droplets" },
      { id: "rain-roof", title: "Roof rain", note: "Steady rainfall" },
    ],
    videoLoops: [{ id: "rain-window" }, { id: "rain-street" }],
  },
  {
    id: "library",
    title: "Quiet library",
    category: "Focus",
    description: "Pages and a quiet room",
    audioTracks: [{ id: "pages", title: "Turning pages", note: "Close paper" }],
    videoLoops: [{ id: "reading-room" }],
  },
];

test("shareable mixes round-trip without carrying user-entered names", () => {
  const encoded = encodeMixSnapshot({
    name: "Personal name must stay local",
    sceneId: "rain",
    trackIds: ["rain-soft", "rain-roof"],
    layerVolumes: { "rain-soft": 0.91, "rain-roof": 0.43 },
    videoId: "rain-street",
    masterVolume: 0.64,
    smartMixEnabled: true,
    multiSoundEnabled: true,
    linkedPlayback: false,
    dataSaverMode: true,
  }, scenes);
  const decoded = decodeMixSnapshot(encoded, scenes);

  assert.ok(encoded.length > 10);
  assert.equal(decoded.name, "");
  assert.deepEqual(decoded.trackIds, ["rain-soft", "rain-roof"]);
  assert.deepEqual(decoded.layerVolumes, { "rain-soft": 0.91, "rain-roof": 0.43 });
  assert.equal(decoded.videoId, "rain-street");
  assert.equal(decoded.smartMixEnabled, true);
  assert.equal(decoded.linkedPlayback, false);
  assert.equal(decoded.dataSaverMode, true);
});

test("invalid mix values fall back to playable scene media", () => {
  const normalized = normalizeMixSnapshot({
    sceneId: "missing",
    trackIds: ["missing"],
    videoId: "missing",
    masterVolume: 12,
  }, scenes);

  assert.equal(normalized.sceneId, "rain");
  assert.deepEqual(normalized.trackIds, ["rain-soft"]);
  assert.equal(normalized.videoId, "rain-window");
  assert.equal(normalized.masterVolume, 1);
});

test("scene search covers titles, categories, descriptions, and track metadata", () => {
  assert.deepEqual(filterSceneLibrary(scenes, "pages").map((scene) => scene.id), ["library"]);
  assert.deepEqual(filterSceneLibrary(scenes, "droplets").map((scene) => scene.id), ["rain"]);
  assert.deepEqual(filterSceneLibrary(scenes, "", "Focus").map((scene) => scene.id), ["library"]);
  assert.deepEqual(filterSceneLibrary(scenes, "", "favorites", ["rain"]).map((scene) => scene.id), ["rain"]);
});

test("recent mixes are de-duplicated and saved favorites sort first", () => {
  const snapshot = { sceneId: "rain", trackIds: ["rain-soft"], videoId: "rain-window" };
  const recent = upsertRecentMix([snapshot], snapshot, scenes);
  assert.equal(recent.length, 1);

  const sorted = sortSavedMixes([
    { ...snapshot, id: "older", savedAt: 1 },
    { ...snapshot, id: "favorite", favorite: true, savedAt: 0 },
  ], scenes);
  assert.equal(sorted[0].id, "favorite");
});
