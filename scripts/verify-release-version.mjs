import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tauriConfig = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const cargoToml = await readFile(new URL("../src-tauri/Cargo.toml", import.meta.url), "utf8");
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const expectedTag = `desktop-v${packageJson.version}`;

assert.equal(tauriConfig.version, packageJson.version, "Tauri and package versions must match");
assert.equal(cargoVersion, packageJson.version, "Cargo and package versions must match");
if (process.env.RELEASE_TAG) assert.equal(process.env.RELEASE_TAG, expectedTag, `release tag must be ${expectedTag}`);

console.log(JSON.stringify({ version: packageJson.version, expectedTag, projectRoot }, null, 2));
