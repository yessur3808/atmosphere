import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputRoot = path.join(projectRoot, ".cloudflare-pages");
const defaultCloudflareRoot = "https://atmosphere-soundscapes.pages.dev/";
const fileLimit = 25 * 1024 * 1024;

function normalizedSiteRoot(value) {
  const url = new URL(value || defaultCloudflareRoot);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  url.search = "";
  url.hash = "";
  return url.href;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  }));
  return nested.flat();
}

const discoveryGuideFiles = [
  "rain-sounds.html",
  "brown-noise.html",
  "sleep-sounds.html",
  "focus-sounds.html",
  "forest-sounds.html",
  "night-drive.html",
  "city-sounds.html",
  "weather-sounds.html",
  "quiet-library.html",
  "beach-sounds.html",
];
const requiredFiles = [
  "index.html",
  "discover.html",
  ...discoveryGuideFiles,
  "discover.css",
  "llms.txt",
  "global.css",
  "site.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "privacy.html",
  "terms.html",
  "build/bundle.js",
  "build/bundle.css",
  "_redirects",
  "_headers",
];
for (const file of requiredFiles) await access(path.join(outputRoot, file));

await assert.rejects(access(path.join(outputRoot, "assets")), undefined, "Cloudflare shell must not bundle the media library");

const files = await walk(outputRoot);
let totalBytes = 0;
for (const filePath of files) {
  const file = await stat(filePath);
  totalBytes += file.size;
  assert.ok(file.size <= fileLimit, `${path.relative(outputRoot, filePath)} exceeds Cloudflare Pages' 25 MiB limit`);
}

const siteRoot = normalizedSiteRoot(process.env.CLOUDFLARE_SITE_URL);
const [index, discoveryPage, sitemap, robots, redirects] = await Promise.all([
  readFile(path.join(outputRoot, "index.html"), "utf8"),
  readFile(path.join(outputRoot, discoveryGuideFiles[0]), "utf8"),
  readFile(path.join(outputRoot, "sitemap.xml"), "utf8"),
  readFile(path.join(outputRoot, "robots.txt"), "utf8"),
  readFile(path.join(outputRoot, "_redirects"), "utf8"),
]);

assert.match(index, new RegExp(`<link\\s+rel="canonical"\\s+href="${siteRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
assert.ok(index.includes("static.cloudflareinsights.com/beacon.min.js"), "homepage is missing the Cloudflare Web Analytics beacon");
assert.ok(index.includes("c219499324d44a1eaae6d0a689627ddb"), "homepage uses the wrong Cloudflare Web Analytics token");
assert.ok(discoveryPage.includes(`${siteRoot}rain-sounds.html`), "discovery canonical does not use the Cloudflare production origin");
assert.ok(discoveryPage.includes("static.cloudflareinsights.com/beacon.min.js"), "discovery page is missing the Cloudflare Web Analytics beacon");
assert.ok(sitemap.includes(`<loc>${siteRoot}</loc>`), "sitemap does not use the Cloudflare production origin");
for (const file of discoveryGuideFiles) assert.ok(sitemap.includes(`<loc>${siteRoot}${file}</loc>`), `sitemap is missing ${file}`);
assert.ok(robots.includes(`${siteRoot}sitemap.xml`), "robots.txt does not advertise the Cloudflare sitemap");
assert.match(redirects, /^\/assets\/\* https:\/\/yessur3808\.github\.io\/atmosphere\/assets\/:splat 302/m);

console.log(JSON.stringify({
  status: "ok",
  siteRoot,
  files: files.length,
  totalBytes,
  largestAllowedBytes: fileLimit,
}, null, 2));
