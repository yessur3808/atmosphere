import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFile(path.join(projectRoot, file), "utf8");
const publicBase = "https://yessur3808.github.io/atmosphere/";
const socialImage = `${publicBase}assets/videos/posters/space-observation.jpg`;
const indexedPages = [
  { file: "index.html", route: "" },
  { file: "install.html", route: "install.html" },
  { file: "legal.html", route: "legal.html" },
  { file: "privacy.html", route: "privacy.html" },
  { file: "terms.html", route: "terms.html" },
  { file: "security.html", route: "security.html" },
  { file: "licenses.html", route: "licenses.html" },
  { file: "accessibility.html", route: "accessibility.html" },
  { file: "audio-credits.html", route: "audio-credits.html" },
  { file: "video-credits.html", route: "video-credits.html" },
];

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const metaValue = (html, key) =>
  html.match(
    new RegExp(
      `<meta\\s+[^>]*(?:name|property)=["']${escapeRegExp(key)}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
  )?.[1] ?? "";
const canonicalValue = (html) =>
  html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? "";
const titleValue = (html) => html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim() ?? "";

test("every indexed page exposes complete, consistent search and social metadata", async () => {
  const sitemap = await read("public/sitemap.xml");
  const robots = await read("public/robots.txt");
  const pages = await Promise.all(
    indexedPages.map(async ({ file, route }) => ({
      file,
      route,
      html: await read(`public/${file}`),
    })),
  );

  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Allow:\s*\//i);
  assert.match(robots, new RegExp(`Sitemap:\\s*${escapeRegExp(`${publicBase}sitemap.xml`)}`, "i"));
  assert.doesNotMatch(sitemap, /<priority>|<changefreq>/i);
  assert.doesNotMatch(sitemap, /mini-player\.html/i);

  for (const { file, route, html } of pages) {
    const canonical = `${publicBase}${route}`;
    const title = titleValue(html);
    const description = metaValue(html, "description");

    assert.ok(title.length >= 10 && title.length <= 70, `${file} has an unsuitable title length`);
    assert.ok(
      description.length >= 50 && description.length <= 180,
      `${file} has an unsuitable description length`,
    );
    assert.match(html, /<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/i, `${file} should have a primary heading`);
    assert.equal(canonicalValue(html), canonical, `${file} canonical URL is incorrect`);
    assert.match(metaValue(html, "robots"), /index\s*,\s*follow/i, `${file} should be indexable`);

    assert.equal(metaValue(html, "og:type"), "website", `${file} is missing an Open Graph type`);
    assert.equal(metaValue(html, "og:site_name"), "Atmosphere", `${file} has the wrong site name`);
    assert.ok(metaValue(html, "og:title"), `${file} is missing an Open Graph title`);
    assert.ok(metaValue(html, "og:description"), `${file} is missing an Open Graph description`);
    assert.equal(metaValue(html, "og:url"), canonical, `${file} Open Graph URL is incorrect`);
    assert.equal(metaValue(html, "og:image"), socialImage, `${file} uses the wrong social image`);
    assert.equal(metaValue(html, "og:image:width"), "1280", `${file} has the wrong image width`);
    assert.equal(metaValue(html, "og:image:height"), "720", `${file} has the wrong image height`);
    assert.ok(metaValue(html, "og:image:alt"), `${file} is missing social image alt text`);

    assert.equal(metaValue(html, "twitter:card"), "summary_large_image", `${file} uses the wrong card type`);
    assert.ok(metaValue(html, "twitter:title"), `${file} is missing a Twitter title`);
    assert.ok(metaValue(html, "twitter:description"), `${file} is missing a Twitter description`);
    assert.equal(metaValue(html, "twitter:image"), socialImage, `${file} uses the wrong Twitter image`);
    assert.ok(metaValue(html, "twitter:image:alt"), `${file} is missing Twitter image alt text`);

    assert.match(
      sitemap,
      new RegExp(
        `<loc>${escapeRegExp(canonical)}</loc>\\s*<lastmod>\\d{4}-\\d{2}-\\d{2}</lastmod>`,
      ),
      `sitemap is missing ${route || "the homepage"}`,
    );
    assert.doesNotMatch(html, /100\.104\.252\.183/);
  }
});

test("homepage structured data describes the site, page, image, and application", async () => {
  const html = await read("public/index.html");
  const source = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(source, "homepage should expose JSON-LD structured data");

  const data = JSON.parse(source);
  const graph = data["@graph"];
  assert.ok(Array.isArray(graph), "structured data should use an @graph");

  const website = graph.find((entry) => entry["@type"] === "WebSite");
  const webpage = graph.find((entry) => entry["@type"] === "WebPage");
  const image = graph.find((entry) => entry["@type"] === "ImageObject");
  const application = graph.find((entry) => entry["@type"] === "WebApplication");

  assert.equal(website?.url, publicBase);
  assert.equal(webpage?.url, publicBase);
  assert.equal(webpage?.mainEntity?.["@id"], `${publicBase}#app`);
  assert.equal(image?.contentUrl, socialImage);
  assert.equal(image?.width, 1280);
  assert.equal(image?.height, 720);
  assert.equal(application?.url, publicBase);
  assert.equal(application?.offers?.price, 0);
  assert.equal(application?.offers?.priceCurrency, "USD");
  assert.equal(application?.image?.contentUrl, `${publicBase}atmosphere-icon-v2.png`);
  assert.equal(application?.screenshot?.["@id"], `${publicBase}#primaryimage`);
  assert.match(application?.dateModified ?? "", /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(application?.featureList?.length >= 6);
});

test("homepage has useful non-JavaScript fallback content", async () => {
  const html = await read("public/index.html");
  const fallback = html.match(/<noscript>([\s\S]*?)<\/noscript>/i)?.[1] ?? "";

  assert.match(fallback, /<h1>Atmosphere ambient sound mixer<\/h1>/i);
  assert.match(fallback, /155 ambient tracks/i);
  assert.match(fallback, /126 cinematic video loops/i);
  assert.match(fallback, /href=["'](?:install|legal|audio-credits|video-credits)\.html["']/i);
});

test("manifest and static entry points use project-relative paths", async () => {
  const manifest = JSON.parse(await read("public/site.webmanifest"));
  const html = await read("public/index.html");

  assert.equal(manifest.id, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.prefer_related_applications, false);
  assert.deepEqual(manifest.display_override, ["window-controls-overlay", "standalone", "minimal-ui", "browser"]);
  assert.ok(manifest.description.length >= 50);
  assert.ok(manifest.icons.every(({ src }) => !src.startsWith("/")));
  assert.match(html, /href='global\.css'/);
  const scriptVersion = html.match(/src='build\/bundle\.js\?v=atmosphere-(\d+)'/)?.[1];
  const styleVersion = html.match(/href='build\/bundle\.css\?v=atmosphere-(\d+)'/)?.[1];
  assert.ok(scriptVersion, "JavaScript bundle should have a numeric cache version");
  assert.equal(styleVersion, scriptVersion, "CSS and JavaScript cache versions should match");
  assert.doesNotMatch(html, /(?:href|src)=["']\/(?!\/)/);
});
