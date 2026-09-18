import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const targetRoot = path.join(projectRoot, "src-tauri", "target");
const output = path.resolve(projectRoot, process.argv[2] || "checksums.txt");
const installerPattern = /\.(?:dmg|msi|exe|appimage|deb|rpm)$/i;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  }));
  return files.flat();
}

const installers = (await walk(targetRoot))
  .filter((file) => file.includes(`${path.sep}bundle${path.sep}`) && installerPattern.test(file))
  .sort();

if (!installers.length) throw new Error("No packaged desktop installers were found");

const lines = [];
for (const file of installers) {
  const digest = createHash("sha256").update(await readFile(file)).digest("hex");
  lines.push(`${digest}  ${path.basename(file)}`);
}

await writeFile(output, `${lines.join("\n")}\n`);
console.log(JSON.stringify({ output, installers: installers.map((file) => path.basename(file)) }, null, 2));
