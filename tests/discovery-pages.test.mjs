import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { discoveryGuides } from "../src/discoveryGuides.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(projectRoot, "public");
const read = (file) => readFile(path.join(publicRoot, file), "utf8");

test("discovery pages cover high-intent sound searches with useful static content", async () => {
  assert.equal(discoveryGuides.length, 10);
  assert.equal(new Set(discoveryGuides.map(({ slug }) => slug)).size, discoveryGuides.length);
  assert.equal(new Set(discoveryGuides.map(({ sceneId }) => sceneId)).size, discoveryGuides.length - 1);

  const hub = await read("discover.html");
  const sitemap = await read("sitemap.xml");
  assert.match(hub, /<h1>Soundscapes for the room you need now<\/h1>/);
  assert.match(hub, /"@type":"ItemList"/);

  for (const guide of discoveryGuides) {
    const html = await read(`${guide.slug}.html`);
    assert.match(html, new RegExp(`<h1>${guide.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</h1>`));
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, new RegExp(`scene=${guide.sceneId}`));
    assert.match(html, /utm_source=organic/);
    assert.match(html, /utm_campaign=sound_guides/);
    assert.match(html, /No account required/);
    assert.doesNotMatch(html, /<video|<audio/i);
    assert.match(hub, new RegExp(`href="${guide.slug}\\.html"`));
    assert.match(sitemap, new RegExp(`<loc>https://yessur3808\\.github\\.io/atmosphere/${guide.slug}\\.html</loc>`));
  }
});

test("the player honors valid scene deep links before local resume state", async () => {
  const source = await readFile(path.join(projectRoot, "src/App.svelte"), "utf8");
  assert.match(source, /searchParams\.get\("scene"\)/);
  assert.match(source, /scenes\.findIndex\(\(scene\) => scene\.id === requestedSceneId\)/);
  assert.match(source, /else if \(requestedSceneIndex >= 0\)/);
  assert.match(source, /else if \(resumeMix\)/);
  assert.ok(source.indexOf("else if (requestedSceneIndex >= 0)") < source.indexOf("else if (resumeMix)"));
});

test("Cloudflare production preparation retains every discovery page", async () => {
  const prepare = await readFile(path.join(projectRoot, "scripts/prepare-cloudflare-pages.mjs"), "utf8");
  const verify = await readFile(path.join(projectRoot, "scripts/verify-cloudflare-pages.mjs"), "utf8");
  assert.match(prepare, /\.html/);
  assert.match(verify, /discover\.html/);
  assert.match(verify, /discoveryGuideFiles/);
  assert.match(prepare, /cloudflare-web-analytics-loader\.js/);
  assert.match(verify, /regional Cloudflare Web Analytics loader/);
  assert.match(verify, /c219499324d44a1eaae6d0a689627ddb/);
});
