import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const metadata = JSON.parse(await readFile(join(projectRoot, "audio-metadata.json"), "utf8"));
const byTitle = new Map(metadata.map((item) => [item.sourceTitle, item]));
const cacheRoot = join(projectRoot, ".audited-media-cache");
const ffmpegImage = "docker.io/jrottenberg/ffmpeg:7.1-alpine";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const audioJobs = [
  ["File:Mount Rainier Holiday Hearth.webm", "public/assets/audio/fire/03-low-embers.mp3", 94],
  ["File:Ocean waves at Lækjavik beach, Iceland.webm", "public/assets/audio/ocean_waves/02-deep-tide.mp3", 0],
  ["File:399603 dustin-davis typing.wav", "public/assets/audio/typing/05-studio-desk.mp3", 180],
  ["File:Rincón de la Vieja hot spring.ogv", "public/assets/audio/onsen/01-hot-spring-pool.mp3", 0],
  ["File:Suikinkutsu recording.ogg", "public/assets/audio/onsen/02-stone-basin.mp3", 0],
  ["File:Warm water 5.ogg", "public/assets/audio/onsen/03-garden-rain.mp3", 0],
  ["File:20121112 TU Delft Library, quiet study room - general ambience - SoundCloud - el mar.ogg", "public/assets/audio/library/05-archive-room.mp3", 72],
  ["File:404114 felix-blume toucans-singing-in-the-amazonian-rainforest-brazil.ogg", "public/assets/audio/jungle/02-tropical-chorus.mp3", 96],
  ["File:Jungle Sound Thailand Phuket.flac", "public/assets/audio/jungle/04-broad-leaves.mp3", 0],
  ["File:Sound of the jungle in Thailand.flac", "public/assets/audio/jungle/05-night-insects.mp3", 0],
];

const videoJobs = [
  ["File:Onsen-rotenburo-winter2014.ogv", "onsen/winter-rotenburo.mp4"],
  ["File:Kusatsu gunma yubatake - 2020 3 1.webm", "onsen/kusatsu-yubatake.mp4"],
  ["File:Jigokudani Monkey Park - hotsprings.ogv", "onsen/jigokudani-spring.mp4"],
  ["File:Cat body language.webm", "cat-window/window-watchers.mp4"],
];

await mkdir(cacheRoot, { recursive: true });

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

function containerPath(path) {
  return `/work/${path.slice(projectRoot.length)}`;
}

async function download(title) {
  const source = byTitle.get(title);
  if (!source) throw new Error(`Missing metadata for ${title}`);
  const extension = new URL(source.sourceUrl).pathname.match(/\.[^.]+$/)?.[0] || ".media";
  const target = join(cacheRoot, `${Buffer.from(title).toString("hex").slice(0, 24)}${extension}`);
  if (await stat(target).then((item) => item.size > 0).catch(() => false)) return target;
  let response;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await fetch(source.sourceUrl, {
      headers: { "User-Agent": "AtmosphereMediaAudit/1.0" },
    });
    if (response.ok && response.body) break;
    if (response.status !== 429 || attempt === 5) {
      throw new Error(`Download failed (${response.status}): ${title}`);
    }
    const retryAfter = Number(response.headers.get("retry-after") || 0) * 1000;
    await wait(Math.max(retryAfter, 7000 * (attempt + 1)));
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  await wait(1200);
  return target;
}

async function encodeAudio(input, output, start) {
  await mkdir(dirname(output), { recursive: true });
  await run("podman", [
    "run", "--rm", "--network", "none", "-v", `${projectRoot}:/work:rw`, "-w", "/work",
    ffmpegImage,
    "-hide_banner", "-loglevel", "error", "-stream_loop", "-1", "-ss", String(start),
    "-i", containerPath(input), "-t", "60", "-vn",
    "-af", "highpass=f=25,loudnorm=I=-21:TP=-2:LRA=11,afade=t=in:st=0:d=0.45,afade=t=out:st=59.55:d=0.45",
    "-ar", "44100", "-ac", "2", "-codec:a", "libmp3lame", "-b:a", "160k", "-y", containerPath(output),
  ]);
}

async function encodeVideo(input, output, maxWidth, crf) {
  await mkdir(dirname(output), { recursive: true });
  await run("podman", [
    "run", "--rm", "--network", "none", "-v", `${projectRoot}:/work:rw`, "-w", "/work",
    ffmpegImage,
    "-hide_banner", "-loglevel", "error", "-i", containerPath(input),
    "-vf", `scale='min(${maxWidth},iw)':-2`, "-an", "-c:v", "libx264", "-preset", "medium",
    "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", containerPath(output),
  ]);
}

for (const [title, relativeOutput, start] of audioJobs) {
  console.log(`Refreshing audio: ${relativeOutput}`);
  const input = await download(title);
  await encodeAudio(input, join(projectRoot, relativeOutput), start);
}

for (const [title, relativeOutput] of videoJobs) {
  console.log(`Refreshing video: ${relativeOutput}`);
  const input = await download(title);
  await encodeVideo(input, join(projectRoot, "public/assets/videos/loops", relativeOutput), 1920, 20);
  await encodeVideo(input, join(projectRoot, "public/assets/videos/adaptive/loops", relativeOutput), 1280, 23);
}

await rm(cacheRoot, { recursive: true, force: true });
console.log(`Refreshed ${audioJobs.length} audio files and ${videoJobs.length * 2} video encodes.`);
