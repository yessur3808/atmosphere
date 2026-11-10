import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const loader = await readFile(path.join(projectRoot, "public/cloudflare-web-analytics-loader.js"), "utf8");

test("Cloudflare reach measurement is regionally gated and fails closed", () => {
  assert.match(loader, /fetch\("\/cdn-cgi\/trace"/);
  assert.match(loader, /credentials: "omit"/);
  assert.match(loader, /referrerPolicy: "no-referrer"/);
  assert.match(loader, /if \(!country \|\| excludedRegions\.has\(country\)/);
  assert.match(loader, /"GB", "CH"/);
  assert.match(loader, /catch \{/);
  assert.match(loader, /Fail closed/);
  assert.doesNotMatch(loader, /localStorage|sessionStorage|document\.cookie/);
});

test("Cloudflare reach measurement avoids duplicate beacons", () => {
  assert.match(loader, /document\.querySelector\(beaconSelector\)/);
  assert.match(loader, /static\.cloudflareinsights\.com\/beacon\.min\.js/);
  assert.match(loader, /c219499324d44a1eaae6d0a689627ddb/);
});
