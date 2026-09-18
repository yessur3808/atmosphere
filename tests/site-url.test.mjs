import assert from "node:assert/strict";
import test from "node:test";

import { desktopMediaRoot, resolveMediaUrl, resolveSiteUrl } from "../src/siteUrl.mjs";

test("resolves local assets beneath a GitHub Pages project path", () => {
  assert.equal(
    resolveSiteUrl("/assets/audio/rain/01-window-rain.mp3", "https://yessur3808.github.io/atmosphere/"),
    "https://yessur3808.github.io/atmosphere/assets/audio/rain/01-window-rain.mp3",
  );
});

test("resolves the same assets from the local server root", () => {
  assert.equal(
    resolveSiteUrl("assets/videos/posters/forest.jpg", "http://100.104.252.183:4173/"),
    "http://100.104.252.183:4173/assets/videos/posters/forest.jpg",
  );
});

test("leaves CDN, data, and blob URLs unchanged", () => {
  for (const url of [
    "https://cdn.coverr.co/example.mp4",
    "data:image/svg+xml,%3Csvg%3E",
    "blob:https://example.com/id",
  ]) {
    assert.equal(resolveSiteUrl(url, "https://yessur3808.github.io/atmosphere/"), url);
  }
});

test("desktop runtime streams relative media from the public HTTPS library", () => {
  assert.equal(
    resolveMediaUrl("assets/audio/rain/01-window-rain.mp3", "tauri://localhost/", true),
    `${desktopMediaRoot}assets/audio/rain/01-window-rain.mp3`,
  );
  assert.equal(
    resolveMediaUrl("https://cdn.coverr.co/example.mp4", "tauri://localhost/", true),
    "https://cdn.coverr.co/example.mp4",
  );
});
