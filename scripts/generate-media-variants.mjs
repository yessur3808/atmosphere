import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(projectRoot, "public");
const ffmpegImage = "docker.io/jrottenberg/ffmpeg:7.1-alpine";
const checkOnly = process.argv.includes("--check");
const force = process.argv.includes("--force");
const generateAudio = process.argv.includes("--audio") || !process.argv.some((value) => ["--audio", "--video"].includes(value));
const generateVideo = process.argv.includes("--video") || !process.argv.some((value) => ["--audio", "--video"].includes(value));
const nativeFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

function containerPath(absolutePath) {
  return `/work/${path.relative(projectRoot, absolutePath)}`;
}

async function encode(input, output, args) {
  await mkdir(path.dirname(output), { recursive: true });
  if (nativeFfmpeg) {
    await run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", input, ...args, output]);
    return;
  }
  await run("podman", [
    "run", "--rm", "--network", "none", "-v", `${projectRoot}:/work:rw`, "-w", "/work",
    ffmpegImage, "-hide_banner", "-loglevel", "error", "-y", "-i", containerPath(input), ...args, containerPath(output),
  ]);
}

async function validFile(filePath) {
  return stat(filePath).then((item) => item.size > 0).catch(() => false);
}

async function requireFile(filePath, label) {
  if (!await validFile(filePath)) throw new Error(`Missing ${label}: ${path.relative(projectRoot, filePath)}`);
}

const [audioSources, videoSources] = await Promise.all([
  readFile(path.join(publicRoot, "assets/audio/SOURCES.json"), "utf8").then(JSON.parse),
  readFile(path.join(projectRoot, "src/videoLoops.resolved.json"), "utf8").then(JSON.parse),
]);

const uniqueAudioPaths = [...new Set(audioSources.map(({ file }) => String(file).replace(/^\/+/, "")))];
if (generateAudio) {
  for (const sourcePath of uniqueAudioPaths) {
    const input = path.join(publicRoot, sourcePath);
    const outputPath = sourcePath.replace(/^assets\/audio\//, "assets/audio-low/");
    const output = path.join(publicRoot, outputPath);
    await requireFile(input, "full-quality audio source");
    if (checkOnly) {
      await requireFile(output, "balanced audio variant");
    } else if (force || !await validFile(output)) {
      console.log(`Encoding balanced audio: ${outputPath}`);
      await encode(input, output, ["-map", "0:a:0", "-vn", "-ar", "44100", "-ac", "2", "-b:a", "64k", "-map_metadata", "-1"]);
    }
  }
}

const localVideoPaths = [...new Set(Object.values(videoSources).flat()
  .map(({ high }) => high)
  .filter((value) => value && !/^https?:\/\//i.test(value)))];
const videoWebm = {};
if (generateVideo) {
  for (const sourcePath of localVideoPaths) {
    const input = path.join(publicRoot, sourcePath);
    const relativeLoopPath = sourcePath.replace(/^assets\/videos\/loops\//, "").replace(/\.mp4$/i, ".webm");
    const outputPath = `assets/videos/webm/${relativeLoopPath}`;
    const output = path.join(publicRoot, outputPath);
    videoWebm[sourcePath] = outputPath;
    await requireFile(input, "full-quality video source");
    if (checkOnly) {
      await requireFile(output, "balanced WebM video variant");
    } else if (force || !await validFile(output)) {
      console.log(`Encoding balanced WebM: ${outputPath}`);
      await encode(input, output, [
        "-map", "0:v:0", "-an", "-vf", "scale='min(1280,iw)':-2:force_original_aspect_ratio=decrease",
        "-c:v", "libvpx-vp9", "-crf", "38", "-b:v", "0", "-deadline", "good", "-cpu-used", "3", "-row-mt", "1",
      ]);
    }
  }
}

const manifestPath = path.join(projectRoot, "src/mediaVariants.json");
const manifestJson = `${JSON.stringify({ videoWebm }, null, 2)}\n`;
if (checkOnly) {
  await access(manifestPath);
  const existing = await readFile(manifestPath, "utf8");
  if (generateVideo && existing !== manifestJson) throw new Error("src/mediaVariants.json is stale; run npm run media:variants");
} else if (generateVideo) {
  await writeFile(manifestPath, manifestJson);
}

console.log(JSON.stringify({
  mode: checkOnly ? "check" : "generate",
  encoder: nativeFfmpeg ? "ffmpeg" : "podman",
  audioVariants: generateAudio ? uniqueAudioPaths.length : 0,
  videoVariants: generateVideo ? localVideoPaths.length : 0,
}, null, 2));
