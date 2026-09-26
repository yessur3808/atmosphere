import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(projectRoot, "public");
const outputRoot = path.join(projectRoot, "desktop-dist");
const shellFiles = [
  "index.html",
  "global.css",
  "site.webmanifest",
  "favicon.png",
  "favicon-v2.png",
  "apple-touch-icon-v2.png",
  "atmosphere-icon-v2.png",
  "audio-credits.html",
  "video-credits.html",
  "mini-player.html",
  "legal.css",
  "legal.html",
  "privacy.html",
  "cookies.html",
  "analytics.html",
  "terms.html",
  "install.html",
  "security.html",
  "licenses.html",
  "accessibility.html",
];

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await Promise.all(shellFiles.map((file) => cp(path.join(publicRoot, file), path.join(outputRoot, file))));
await cp(path.join(publicRoot, "build"), path.join(outputRoot, "build"), { recursive: true });

const rootEntries = await readdir(outputRoot);
if (rootEntries.includes("assets")) throw new Error("desktop shell unexpectedly contains the media library");

console.log(JSON.stringify({ output: outputRoot, files: shellFiles.length, mediaBundled: false }, null, 2));
