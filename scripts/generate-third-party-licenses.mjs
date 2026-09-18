import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outputPath = path.join(projectRoot, "THIRD_PARTY_LICENSES.json");
const packageLock = JSON.parse(await readFile(path.join(projectRoot, "package-lock.json"), "utf8"));

const npm = Object.entries(packageLock.packages || {})
  .filter(([location, details]) => location.includes("node_modules/") && details.version)
  .map(([location, details]) => ({
    name: location.split("node_modules/").at(-1),
    version: details.version,
    license: details.license || "UNKNOWN",
    resolved: details.resolved || "",
  }))
  .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

const cargoMetadata = JSON.parse(execFileSync("cargo", ["metadata", "--locked", "--format-version", "1", "--manifest-path", path.join(projectRoot, "src-tauri", "Cargo.toml")], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 }));
const cargo = cargoMetadata.packages
  .filter((item) => item.source)
  .map((item) => ({ name: item.name, version: item.version, license: item.license || "UNKNOWN", source: item.source }))
  .sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

const inventory = {
  notice: "Informational inventory generated from package-lock.json and Cargo metadata. Upstream license files are authoritative.",
  applicationLicense: "Atmosphere Source Code License — see LICENSE",
  npm,
  cargo,
};
const serialized = `${JSON.stringify(inventory, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = await readFile(outputPath, "utf8");
  if (current !== serialized) throw new Error("THIRD_PARTY_LICENSES.json is out of date; run npm run licenses:generate");
  console.log(`Verified ${npm.length} npm and ${cargo.length} Cargo dependency license records`);
} else {
  await writeFile(outputPath, serialized);
  console.log(`Wrote ${npm.length} npm and ${cargo.length} Cargo dependency license records`);
}
