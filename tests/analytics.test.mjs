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
    "listening_interval",
    "meaningful_listening",
    "retained_listening",
    "engagement_heartbeat",
    "session_summary",
    "monetization_eligible",
    "sound_recipe_apply",
  ]) {
    assert.ok(analyticsSource.includes(eventName) || appSource.includes(eventName), `${eventName} is missing`);
  }
});

test("analytics reports content usage with decision-ready dimensions", () => {
  for (const parameter of [
    "analytics_schema",
    "app_surface",
    "display_mode",
    "scene_id",
    "scene_title",
    "scene_category",
    "track_id",
    "track_type",
    "sound_category",
    "recipe_id",
    "recipe_title",
    "mix_source",
    "video_id",
    "playback_mode",
    "data_saver",
    "smart_mix",
    "live_weather",
    "quiet_view",
    "viewport_bucket",
  ]) {
    assert.ok(analyticsSource.includes(parameter), `${parameter} is missing from analytics context`);
  }
});

test("listening time is attributed in non-cumulative intervals and summarized once", () => {
  assert.match(analyticsSource, /listening_interval_seconds:\s*Math\.round\(intervalMilliseconds \/ 1000\)/);
  assert.match(analyticsSource, /session_listening_seconds:\s*Math\.round\(listeningMilliseconds \/ 1000\)/);
  assert.match(analyticsSource, /unique_scene_count:\s*uniqueSceneIds\.size/);
  assert.match(analyticsSource, /unique_track_count:\s*uniqueTrackIds\.size/);
  assert.match(appSource, /fadeAndPauseAllAudio\(audioCrossfadeMilliseconds \/ 2,\s*"atmosphere_change"\)/);
  assert.match(appSource, /checkpointAnalytics\("audio_layer_change"\)/);
  assert.match(appSource, /checkpointAnalytics\("video_loop_change"\)/);
});

test("recommended GA4 content and share events complement historical custom events", () => {
  assert.match(appSource, /trackEvent\("select_content"/);
  assert.match(appSource, /content_type:\s*"atmosphere"/);
  assert.match(appSource, /content_type:\s*"sound_recipe"/);
  assert.match(appSource, /trackEvent\("share"/);
  assert.match(appSource, /content_type:\s*"ambient_mix"/);
});

test("analytics strips private mix payloads from page URLs", () => {
  assert.match(analyticsSource, /searchParams\.set\("mix",\s*"shared"\)/);
  assert.doesNotMatch(appSource, /trackEvent\([^\n]*weatherCityQuery/);
  assert.doesNotMatch(appSource, /trackEvent\([^\n]*saveMixName/);
});

test("feature action totals exclude passive page and atmosphere views", () => {
  assert.doesNotMatch(analyticsSource, /\(_preference\|_open\|_close\|_enter\|_exit\|_toggle\|_view\)/);
  assert.match(analyticsSource, /"settings_open"/);
  assert.match(analyticsSource, /"weather_match_apply"/);
});

test("GA4 uses one production Measurement ID", () => {
  const measurementId = indexSource.match(/name="google-analytics-id" content="(G-[A-Z0-9]+)"/);
  assert.ok(measurementId, "GA4 Measurement ID is missing or malformed");
  assert.notEqual(measurementId[1], "G-XXXXXXXXXX", "GA4 Measurement ID is still a placeholder");
  assert.equal((indexSource.match(/google-analytics-id/g) || []).length, 1);
});
