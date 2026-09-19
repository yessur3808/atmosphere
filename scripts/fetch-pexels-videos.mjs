import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const library = JSON.parse(await readFile(join(projectRoot, "src/videoLoops.json"), "utf8"));
const requestedScenes = String(process.env.ATMOSPHERE_SCENES || "")
  .split(",").map((scene) => scene.trim()).filter(Boolean);
const cacheRoot = join(projectRoot, ".pexels-source-cache");
const downloaderImage = "docker.io/jauderho/yt-dlp:latest";
const ffmpegImage = "docker.io/jrottenberg/ffmpeg:7.1-alpine";
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
}

function containerPath(localPath) {
  return `/work/${localPath.slice(projectRoot.length)}`;
}

async function exists(path) {
  return stat(path).then((item) => item.size > 0).catch(() => false);
}

async function encode(input, output, maxWidth, crf) {
  await mkdir(dirname(output), { recursive: true });
  await run("podman", [
    "run", "--rm", "--network", "none", "-v", `${projectRoot}:/work:rw`, "-w", "/work",
    ffmpegImage, "-hide_banner", "-loglevel", "error", "-i", containerPath(input),
    "-map", "0:v:0", "-an", "-vf", `scale='min(${maxWidth},iw)':-2`,
    "-c:v", "libx264", "-preset", "medium", "-crf", String(crf), "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-y", containerPath(output),
  ]);
}

const jobs = Object.entries(library).flatMap(([sceneId, entries]) => {
  if (requestedScenes.length && !requestedScenes.includes(sceneId)) return [];
  return entries.filter((entry) => entry.source.includes("pexels.com/video/") && entry.high && entry.adaptive)
    .map((entry, index) => ({ sceneId, entry, index }));
});

await mkdir(cacheRoot, { recursive: true });
for (const { sceneId, entry, index } of jobs) {
  const highOutput = join(projectRoot, "public", entry.high);
  const adaptiveOutput = join(projectRoot, "public", entry.adaptive);
  if (await exists(highOutput) && await exists(adaptiveOutput)) {
    console.log(`Using existing Pexels encodes: ${sceneId}/${entry.file}`);
    continue;
  }

  const sourceFile = join(cacheRoot, `${sceneId}-${index}.mp4`);
  console.log(`Downloading licensed Pexels source: ${entry.source}`);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      await run("podman", [
        "run", "--rm", "-v", `${projectRoot}:/work:rw`, "-w", "/work", downloaderImage,
        "--extractor-args", "generic:impersonate", "--no-playlist", "--no-part", "-f", "0",
        "-o", containerPath(sourceFile), entry.source,
      ]);
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      console.warn(`Pexels request failed; retrying (${attempt}/4).`);
      await rm(sourceFile, { force: true });
      await wait(5000 * attempt);
    }
  }
  await encode(sourceFile, highOutput, 1920, 20);
  await encode(sourceFile, adaptiveOutput, 1280, 23);
  console.log(`Prepared Pexels loop: ${sceneId}/${entry.file}`);
}

await rm(cacheRoot, { recursive: true, force: true });
console.log(`Prepared ${jobs.length} Pexels video loops.`);
