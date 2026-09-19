import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const tabs = JSON.parse(await readFile(join(projectRoot, "src/tabsData.json"), "utf8"));
const loops = JSON.parse(await readFile(join(projectRoot, "src/videoLoops.resolved.json"), "utf8"));
const requestedScenes = String(process.env.ATMOSPHERE_SCENES || "")
  .split(",").map((scene) => scene.trim()).filter(Boolean);
const posterRoot = join(projectRoot, "public/assets/videos/posters");
const ffmpegImage = "docker.io/jrottenberg/ffmpeg:7.1-alpine";

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

await mkdir(posterRoot, { recursive: true });
const scenes = tabs.filter((scene) => !requestedScenes.length || requestedScenes.includes(scene.id));
for (const scene of scenes) {
  const firstLoop = loops[scene.id]?.[0];
  if (!firstLoop?.high) throw new Error(`No resolved video for ${scene.id}`);
  const input = /^https?:/.test(firstLoop.high)
    ? firstLoop.high
    : containerPath(join(projectRoot, "public", firstLoop.high));
  const stem = scene.background.replace(/\.[^.]+$/, "");
  const output = join(posterRoot, `${stem}.jpg`);
  await run("podman", [
    "run", "--rm", "-v", `${projectRoot}:/work:rw`, "-w", "/work", ffmpegImage,
    "-hide_banner", "-loglevel", "error", "-ss", "1", "-i", input,
    "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2", "-q:v", "3", "-y",
    containerPath(output),
  ]);
  console.log(`Generated poster: ${scene.id}`);
}
