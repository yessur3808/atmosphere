import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const catalog = JSON.parse(await readFile(join(projectRoot, "audio-sources.json"), "utf8"));
const metadata = JSON.parse(await readFile(join(projectRoot, "audio-metadata.json"), "utf8"));
const priorManifest = JSON.parse(await readFile(join(projectRoot, "public/assets/audio/SOURCES.json"), "utf8"));
const byTitle = new Map(metadata.map((item) => [item.sourceTitle, item]));
const priorByFile = new Map(priorManifest.map((item) => [item.file, item]));
const manifestByFile = new Map();

for (const [sceneId, tracks] of Object.entries(catalog)) {
  const folder = sceneId.replace(/^tab_/, "");
  for (const track of tracks) {
    const file = track.src || `/assets/audio/${folder}/${track.file}`;
    if (manifestByFile.has(file)) continue;
    const source = byTitle.get(track.sourceTitle);
    const prior = priorByFile.get(file);
    if (!source && !prior) throw new Error(`No attribution metadata for ${file} (${track.sourceTitle})`);
    manifestByFile.set(file, source ? {
      sceneId,
      file,
      title: track.title,
      sourceTitle: source.sourceTitle.replace(/^File:/, ""),
      sourcePage: source.sourcePage,
      artist: source.artist,
      license: source.license,
      licenseUrl: source.licenseUrl,
      edit: "60-second normalized MP3 excerpt; fade in/out; stereo 44.1 kHz at 160 kbps",
    } : { ...prior, sceneId, title: track.title });
  }
}

const manifest = [...manifestByFile.values()];
await writeFile(join(projectRoot, "public/assets/audio/SOURCES.json"), `${JSON.stringify(manifest, null, 2)}\n`);

const escapeHtml = (value) => String(value || "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const uniqueCredits = [...new Map(manifest.map((item) => [item.sourcePage, item])).values()];
await writeFile(join(projectRoot, "public/audio-credits.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Atmosphere audio credits</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0c0d0f;color:#f4f4f1;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{width:min(900px,calc(100% - 36px));margin:0 auto;padding:72px 0 96px}a{color:#d9e7ff}p{color:#a9abb1}.back{display:inline-block;margin-bottom:36px;text-decoration:none}.credit{padding:20px 0;border-top:1px solid #2b2d31}.credit h2{font-size:1rem;margin:0 0 5px}.credit p{margin:3px 0;font-size:.9rem}.license{display:inline-flex;padding:4px 9px;border:1px solid #3b3d42;border-radius:99px;text-decoration:none;font-size:.78rem}
</style></head><body><main><a class="back" href="./">← Back to Atmosphere</a><h1>Audio credits</h1><p>${manifest.length} theme-matched audio files edited from ${uniqueCredits.length} openly licensed music and ambience recordings. Each file is normalized to a consistent listening level and remains available under the same license as its source.</p>
${uniqueCredits.map((item) => `<article class="credit"><h2><a href="${escapeHtml(item.sourcePage)}">${escapeHtml(item.sourceTitle)}</a></h2><p>${escapeHtml(item.artist || "Creator listed on source page")}</p><a class="license" href="${escapeHtml(item.licenseUrl || item.sourcePage)}">${escapeHtml(item.license)}</a></article>`).join("\n")}
</main></body></html>\n`);

console.log(`Wrote ${manifest.length} file attributions from ${uniqueCredits.length} source recordings.`);
