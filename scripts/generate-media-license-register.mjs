import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(projectRoot, "public");
const checkedAt = "2026-09-27";

const pexelsCreators = new Map([
  ["https://www.pexels.com/video/a-person-riding-an-elevator-5080921/", "ITO JUNICHI"],
  ["https://www.pexels.com/video/video-of-brown-liquid-4219852/", "OMerchMedia"],
  ["https://www.pexels.com/video/stars-and-the-planet-earth-7184620/", "Nino Souza"],
  ["https://www.pexels.com/video/lost-astronaut-gazes-at-earth-s-horizon-from-spaceship-29779800/", "Adis Resic"],
  ["https://www.pexels.com/video/futuristic-spaceship-traveling-through-galaxy-29882130/", "Adis Resic"],
  ["https://www.pexels.com/video/dynamic-cosmic-starfield-animation-37652488/", "Nicola Narracci"],
  ["https://www.pexels.com/video/nighttime-rain-drive-through-city-streets-31940805/", "Gera Cejas"],
  ["https://www.pexels.com/video/point-of-view-of-a-person-driving-a-car-at-night-3895030/", "Kelly Regan"],
  ["https://www.pexels.com/video/video-of-dubai-traffic-at-night-5057525/", "Max Avans"],
  ["https://www.pexels.com/video/video-of-cars-on-the-road-5741833/", "Saul"],
  ["https://www.pexels.com/video/driving-through-a-modern-tunnel-at-night-35987757/", "LayG Traveller"],
  ["https://www.pexels.com/video/driving-in-a-road-at-night-5542449/", "Sameer Choubey"],
  ["https://www.pexels.com/video/a-snow-covered-road-7080152/", "Lars H Knudsen"],
  ["https://www.pexels.com/video/scenic-coastal-highway-at-twilight-36550391/", "SHEMÁ"],
  ["https://www.pexels.com/video/a-car-driving-through-a-city-at-night-19830439/", "Orhan Pergel"],
]);

const commonsDetails = new Map([
  ["https://commons.wikimedia.org/wiki/File:Onsen-rotenburo-winter2014.ogv", { creator: "Nesnad", license: "CC BY-SA 3.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/" }],
  ["https://commons.wikimedia.org/wiki/File:Kusatsu_gunma_yubatake_-_2020_3_1.webm", { creator: "Nesnad", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" }],
  ["https://commons.wikimedia.org/wiki/File:Cat_body_language.webm", { creator: "Shannon McGee", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/" }],
]);

function relativePublicPath(value) {
  return String(value || "").replace(/^\/+/, "");
}

async function localFileRecord(urlPath, quality, format, transformation) {
  if (!urlPath || /^https?:\/\//i.test(urlPath)) return { url: urlPath, quality, format, hosted: "provider" };
  const relativePath = relativePublicPath(urlPath);
  const absolutePath = path.join(publicRoot, relativePath.replace(/^assets\//, "assets/"));
  await access(absolutePath);
  const fileStats = await stat(absolutePath);
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => createReadStream(absolutePath)
    .on("data", (chunk) => hash.update(chunk))
    .on("error", reject)
    .on("end", resolve));
  return {
    path: relativePath,
    quality,
    format,
    bytes: fileStats.size,
    sha256: hash.digest("hex"),
    transformation,
    hosted: "project",
  };
}

function videoRights(source) {
  if (source.startsWith("https://coverr.co/")) {
    return {
      provider: "Coverr",
      creator: "Coverr contributor identified on the linked source page",
      license: "Coverr License",
      licenseUrl: "https://coverr.co/license",
      attributionRequired: false,
    };
  }
  if (source.startsWith("https://www.pexels.com/")) {
    return {
      provider: "Pexels",
      creator: pexelsCreators.get(source) || "Pexels contributor identified on the linked source page",
      license: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      attributionRequired: false,
    };
  }
  const commons = commonsDetails.get(source);
  if (commons) {
    return {
      provider: "Wikimedia Commons",
      ...commons,
      attributionRequired: true,
    };
  }
  throw new Error(`No video rights record for ${source}`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

const [audioSources, videoSources, scenes, mediaVariants] = await Promise.all([
  readFile(path.join(publicRoot, "assets/audio/SOURCES.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "src/videoLoops.resolved.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "src/tabsData.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "src/mediaVariants.json"), "utf8").then(JSON.parse),
]);

const sceneTitles = new Map(scenes.map((scene) => [scene.id, scene.title]));
const audio = [];
for (const source of audioSources) {
  const highPath = relativePublicPath(source.file);
  const efficientPath = highPath.replace(/^assets\/audio\//, "assets/audio-low/");
  audio.push({
    id: `${source.sceneId}:${path.basename(highPath, path.extname(highPath))}`,
    sceneId: source.sceneId,
    sceneTitle: sceneTitles.get(source.sceneId),
    title: source.title,
    sourceTitle: source.sourceTitle,
    sourcePage: source.sourcePage,
    creator: source.artist || "No creator stated on the source page",
    license: source.license,
    licenseUrl: source.licenseUrl || null,
    attributionRequired: !/^(?:CC0|Public domain)$/i.test(source.license),
    modifications: source.edit,
    checkedAt,
    status: "cleared",
    delivery: [
      await localFileRecord(highPath, "full", "MP3", source.edit),
      await localFileRecord(efficientPath, "balanced", "MP3", "Derived from the cleared full-quality file; stereo 44.1 kHz at 64 kbps with metadata removed"),
    ],
  });
}

const video = [];
for (const [sceneId, loops] of Object.entries(videoSources)) {
  for (const loop of loops) {
    const rights = videoRights(loop.source);
    const delivery = [
      await localFileRecord(loop.high, "full", "MP4", /^https?:/i.test(loop.high) ? null : "Transcoded for web playback; no audio"),
      await localFileRecord(loop.adaptive, "balanced", "MP4", /^https?:/i.test(loop.adaptive) ? null : "720p web derivative; no audio"),
    ];
    const webmPath = mediaVariants.videoWebm?.[loop.high];
    if (webmPath) delivery.push(await localFileRecord(webmPath, "balanced", "WebM/VP9", "720p VP9 web derivative; no audio"));
    video.push({
      id: `${sceneId}:${loop.file}`,
      sceneId,
      sceneTitle: sceneTitles.get(sceneId),
      title: loop.title,
      sourcePage: loop.source,
      ...rights,
      modifications: "Trimmed or transcoded where locally hosted; displayed muted, looped, and cropped responsively",
      checkedAt,
      status: "cleared",
      delivery,
    });
  }
}

const register = {
  schemaVersion: 1,
  checkedAt,
  scope: "Every audio file and video loop active in the Atmosphere catalog, including generated delivery variants",
  reviewRule: "Do not publish an active media item unless source, creator/provider, license, license URL where applicable, modifications, and delivery files are recorded here.",
  licenseReferences: {
    coverr: "https://coverr.co/license",
    pexels: "https://www.pexels.com/license/",
    creativeCommons: "https://creativecommons.org/share-your-work/cclicenses/",
    wikimediaReuse: "https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia",
  },
  counts: {
    audioRecords: audio.length,
    videoRecords: video.length,
    projectHostedAudioFiles: audio.flatMap((entry) => entry.delivery).filter(({ hosted }) => hosted === "project").length,
    projectHostedVideoFiles: video.flatMap((entry) => entry.delivery).filter(({ hosted }) => hosted === "project").length,
  },
  audio,
  video,
};

const registerJson = `${JSON.stringify(register, null, 2)}\n`;
const registerPath = path.join(projectRoot, "MEDIA_LICENSES.json");
if (process.argv.includes("--check")) {
  const existing = await readFile(registerPath, "utf8");
  if (existing !== registerJson) throw new Error("MEDIA_LICENSES.json is stale; run npm run media:licenses");
} else {
  await writeFile(registerPath, registerJson);
}

const creditCards = video.map((entry) => `    <article class="credit"><p class="credit-scene">${escapeHtml(entry.sceneTitle)}</p><h2><a href="${escapeHtml(entry.sourcePage)}">${escapeHtml(entry.title)}</a></h2><p>${escapeHtml(entry.creator)} / ${escapeHtml(entry.provider)}</p><p>${escapeHtml(entry.modifications)}</p><a class="license" href="${escapeHtml(entry.licenseUrl)}">${escapeHtml(entry.license)}</a></article>`).join("\n");
const creditsHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Video credits — Atmosphere</title><meta name="description" content="Source, creator, license, and modification records for every video loop active in Atmosphere."><meta name="robots" content="index, follow"><meta name="theme-color" content="#0a0c0d"><link rel="canonical" href="https://yessur3808.github.io/atmosphere/video-credits.html"><link rel="icon" href="favicon-v2.png"><link rel="stylesheet" href="legal.css"><meta property="og:type" content="website"><meta property="og:site_name" content="Atmosphere"><meta property="og:title" content="Video Credits — Atmosphere"><meta property="og:description" content="Verified sources, creators, licenses, and modifications for every active Atmosphere video loop."><meta property="og:url" content="https://yessur3808.github.io/atmosphere/video-credits.html"><meta property="og:image" content="https://yessur3808.github.io/atmosphere/assets/videos/posters/space-observation.jpg"><meta property="og:image:width" content="1280"><meta property="og:image:height" content="720"><meta property="og:image:alt" content="Earth in a calm starfield from Atmosphere"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Video Credits — Atmosphere"><meta name="twitter:description" content="Verified sources, creators, licenses, and modifications for every active Atmosphere video loop."><meta name="twitter:image" content="https://yessur3808.github.io/atmosphere/assets/videos/posters/space-observation.jpg"><meta name="twitter:image:alt" content="Earth in a calm starfield from Atmosphere"></head><body><div class="legal-shell">
  <nav class="legal-nav" aria-label="Legal navigation"><a class="brand" href="./"><img src="favicon-v2.png" alt=""><span>Atmosphere</span></a><div class="nav-links"><a href="licenses.html">Licenses</a><a href="legal.html">Legal</a></div></nav>
  <header class="legal-hero"><p class="eyebrow">Verified media register</p><h1>Video credits</h1><p class="lede">Every active video loop, its source, provider or creator, governing license, and modification notice. Repeated sources are listed for each atmosphere in which they appear.</p><span class="effective">Reviewed ${checkedAt}</span></header>
  <main class="credits"><div class="callout"><strong>Machine-readable record</strong>The complete register, including file hashes and quality variants, is published as <a href="https://github.com/yessur3808/atmosphere/blob/main/MEDIA_LICENSES.json">MEDIA_LICENSES.json</a>.</div>
${creditCards}
  </main><footer class="legal-footer"><span>© 2026 Atmosphere contributors</span><div><a href="audio-credits.html">Audio credits</a><a href="licenses.html">Licenses</a><a href="./">Open app</a></div></footer>
</div></body></html>\n`;
if (!process.argv.includes("--check")) await writeFile(path.join(publicRoot, "video-credits.html"), creditsHtml);

console.log(JSON.stringify(register.counts, null, 2));
