import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(projectRoot, "public");
const outputRoot = path.join(projectRoot, ".cloudflare-pages");
const currentPublicRoot = "https://yessur3808.github.io/atmosphere/";
const defaultCloudflareRoot = "https://atmosphere-soundscapes.pages.dev/";

function normalizedSiteRoot(value) {
  const url = new URL(value || defaultCloudflareRoot);
  if (url.protocol !== "https:") throw new Error("CLOUDFLARE_SITE_URL must use HTTPS");
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

const siteRoot = normalizedSiteRoot(process.env.CLOUDFLARE_SITE_URL);

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(publicRoot, outputRoot, {
  recursive: true,
  filter: (source) => source !== path.join(publicRoot, "assets"),
});

const textExtensions = new Set([".html", ".xml", ".txt", ".webmanifest"]);
for (const filePath of await walk(outputRoot)) {
  if (!textExtensions.has(path.extname(filePath))) continue;
  const source = await readFile(filePath, "utf8");
  const updated = source.replaceAll(currentPublicRoot, siteRoot);
  if (updated !== source) await writeFile(filePath, updated);
}

await writeFile(path.join(outputRoot, "_redirects"), [
  `/assets/* ${currentPublicRoot}assets/:splat 302`,
  "",
].join("\n"));

await writeFile(path.join(outputRoot, "_headers"), [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), microphone=(), payment=(), usb=()",
  "  X-Frame-Options: SAMEORIGIN",
  "",
  "/build/*",
  "  Cache-Control: public, max-age=31536000, immutable",
  "",
  "/favicon*",
  "  Cache-Control: public, max-age=86400",
  "",
].join("\n"));

const files = await walk(outputRoot);
const totalBytes = (await Promise.all(files.map((filePath) => stat(filePath)))).reduce((sum, file) => sum + file.size, 0);
console.log(JSON.stringify({
  output: outputRoot,
  siteRoot,
  files: files.length,
  totalBytes,
  mediaOrigin: currentPublicRoot,
}, null, 2));
