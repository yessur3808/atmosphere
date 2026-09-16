import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFile(path.join(projectRoot, file), "utf8");

test("SEO metadata targets the public HTTPS deployment", async () => {
  const files = await Promise.all([
    read("public/index.html"),
    read("public/audio-credits.html"),
    read("public/robots.txt"),
    read("public/sitemap.xml"),
  ]);
  const combined = files.join("\n");

  assert.doesNotMatch(combined, /100\.104\.252\.183/);
  assert.match(combined, /https:\/\/yessur3808\.github\.io\/atmosphere\//);
  assert.match(files[0], /110 immersive ambient tracks/);
  assert.match(files[0], /88 cinematic video loops/);
  assert.match(files[0], /22 atmospheres/);
});

test("manifest and static entry points use project-relative paths", async () => {
  const manifest = JSON.parse(await read("public/site.webmanifest"));
  const html = await read("public/index.html");

  assert.equal(manifest.id, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.ok(manifest.icons.every(({ src }) => !src.startsWith("/")));
  assert.match(html, /href='global\.css'/);
  const scriptVersion = html.match(/src='build\/bundle\.js\?v=atmosphere-(\d+)'/)?.[1];
  const styleVersion = html.match(/href='build\/bundle\.css\?v=atmosphere-(\d+)'/)?.[1];
  assert.ok(scriptVersion, "JavaScript bundle should have a numeric cache version");
  assert.equal(styleVersion, scriptVersion, "CSS and JavaScript cache versions should match");
  assert.doesNotMatch(html, /(?:href|src)=["']\/(?!\/)/);
});
