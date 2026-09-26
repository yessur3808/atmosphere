import assert from "node:assert/strict";
import test from "node:test";
import {
  connectionSnapshot,
  efficientAudioRequested,
  effectiveMediaQuality,
  normalizeMediaQuality,
} from "../src/mediaQuality.mjs";

test("media quality preferences normalize safely", () => {
  assert.equal(normalizeMediaQuality("full"), "full");
  assert.equal(normalizeMediaQuality("balanced"), "balanced");
  assert.equal(normalizeMediaQuality("unexpected"), "auto");
});

test("automatic quality respects Save-Data and constrained connections", () => {
  assert.equal(effectiveMediaQuality("auto", { saveData: true }), "balanced");
  assert.equal(effectiveMediaQuality("auto", { effectiveType: "2g" }), "balanced");
  assert.equal(effectiveMediaQuality("auto", { effectiveType: "3g" }), "balanced");
  assert.equal(effectiveMediaQuality("auto", { downlink: 1.5 }), "balanced");
  assert.equal(effectiveMediaQuality("auto", { effectiveType: "4g", downlink: 8 }), "full");
});

test("manual choices remain stable and Data Saver always removes video", () => {
  assert.equal(effectiveMediaQuality("full", { saveData: true }), "full");
  assert.equal(effectiveMediaQuality("balanced", { effectiveType: "4g" }), "balanced");
  assert.equal(effectiveMediaQuality("full", {}, true), "audio-only");
  assert.equal(efficientAudioRequested("auto", { saveData: true }), true);
  assert.equal(efficientAudioRequested("full", { saveData: true }), false);
  assert.equal(efficientAudioRequested("full", {}, true), true);
});

test("connection snapshots avoid retaining detailed browser objects", () => {
  assert.deepEqual(connectionSnapshot({ saveData: 1, effectiveType: "4G", downlink: "3.2", rtt: 400 }), {
    saveData: true,
    effectiveType: "4g",
    downlink: 3.2,
  });
});
