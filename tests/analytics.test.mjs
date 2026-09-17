import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const analyticsSource = await readFile(new URL("../src/analytics.js", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.svelte", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("analytics defaults to denied consent before loading the Google tag", () => {
  const initializer = analyticsSource.slice(
    analyticsSource.indexOf("export function initializeAnalytics"),
    analyticsSource.indexOf("export function setAnalyticsConsent"),
  );
  const consentDefault = initializer.indexOf('gtag("consent", "default"');
  const tagInitialization = initializer.indexOf("loadGoogleTag()");
  assert.ok(consentDefault >= 0, "consent default is missing");
  assert.ok(tagInitialization >= 0, "GA4 configuration is missing");
  assert.ok(consentDefault < tagInitialization, "consent must be configured before GA4");
  assert.match(analyticsSource, /analytics_storage:\s*"denied"/);
  assert.match(analyticsSource, /ad_personalization:\s*"denied"/);
});

test("analytics never requests precise browser geolocation", () => {
  assert.doesNotMatch(analyticsSource, /navigator\.geolocation|watchPosition|getCurrentPosition/);
  assert.doesNotMatch(appSource, /navigator\.geolocation|watchPosition|getCurrentPosition/);
});

test("the monetization measurement funnel is instrumented", () => {
  for (const eventName of [
    "playback_start",
    "listening_milestone",
    "engagement_heartbeat",
    "session_summary",
    "monetization_eligible",
    "sound_recipe_apply",
  ]) {
    assert.ok(analyticsSource.includes(eventName) || appSource.includes(eventName), `${eventName} is missing`);
  }
});

test("GA4 uses one clearly replaceable Measurement ID", () => {
  assert.match(indexSource, /name="google-analytics-id" content="G-XXXXXXXXXX"/);
  assert.equal((indexSource.match(/google-analytics-id/g) || []).length, 1);
});
