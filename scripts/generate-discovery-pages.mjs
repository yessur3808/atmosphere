import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { discoveryGuides, discoveryHub } from "../src/discoveryGuides.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = path.join(projectRoot, "public");
const publicBase = "https://yessur3808.github.io/atmosphere/";
const checkedAt = "2026-11-10";
const checkOnly = process.argv.includes("--check");

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
})[character]);
const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
const guideUrl = (guide) => `${publicBase}${guide.slug}.html`;
const posterUrl = (guide) => `${publicBase}assets/videos/posters/${guide.poster}.jpg`;
const playerUrl = (guide) => `./?scene=${encodeURIComponent(guide.sceneId)}&utm_source=organic&utm_medium=landing_page&utm_campaign=sound_guides&utm_content=${encodeURIComponent(guide.slug)}`;

function metadata({ metaTitle, description, slug, poster = "space-observation", imageAlt }) {
  const canonical = `${publicBase}${slug}.html`;
  const image = `${publicBase}assets/videos/posters/${poster}.jpg`;
  const alt = imageAlt || `${metaTitle.replace(/\s*\|.*$/, "")} in Atmosphere`;
  return `<title>${escapeHtml(metaTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website"><meta property="og:locale" content="en_US"><meta property="og:site_name" content="Atmosphere">
  <meta property="og:title" content="${escapeHtml(metaTitle)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image}"><meta property="og:image:width" content="1280"><meta property="og:image:height" content="720"><meta property="og:image:alt" content="${escapeHtml(alt)}">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(metaTitle)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${image}"><meta name="twitter:image:alt" content="${escapeHtml(alt)}">`;
}
function shellStart(meta) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  ${metadata(meta)}
  <meta name="theme-color" content="#0a0c0d"><meta name="color-scheme" content="dark"><link rel="icon" href="favicon-v2.png"><link rel="apple-touch-icon" href="apple-touch-icon-v2.png"><link rel="stylesheet" href="discover.css">
</head><body><div class="discovery-shell">
  <nav class="discovery-nav" aria-label="Primary"><a class="discovery-brand" href="./"><img src="favicon-v2.png" alt=""><span>Atmosphere</span></a><div><a href="discover.html">Sound guides</a><a href="install.html">Install</a><a class="nav-cta" href="./">Open player</a></div></nav>`;
}
function card(guide, compact = false) {
  return `<a class="guide-card${compact ? " compact" : ""}" href="${guide.slug}.html"><img src="assets/videos/posters/${guide.poster}.jpg" loading="lazy" width="1280" height="720" alt=""><span><small>${escapeHtml(guide.eyebrow)}</small><strong>${escapeHtml(guide.metaTitle.replace(/\s*\|.*$/, ""))}</strong><em>Explore guide <b aria-hidden="true">↗</b></em></span></a>`;
}

function guidePage(guide) {
  const related = discoveryGuides.filter(({ slug }) => slug !== guide.slug).slice(0, 3);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": `${guideUrl(guide)}#webpage`, url: guideUrl(guide), name: guide.metaTitle, description: guide.description, inLanguage: "en-US", dateModified: checkedAt, primaryImageOfPage: { "@id": `${guideUrl(guide)}#primaryimage` }, isPartOf: { "@id": `${publicBase}#website` } },
      { "@type": "ImageObject", "@id": `${guideUrl(guide)}#primaryimage`, contentUrl: posterUrl(guide), width: 1280, height: 720, caption: guide.title },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Atmosphere", item: publicBase },
        { "@type": "ListItem", position: 2, name: "Sound guides", item: `${publicBase}discover.html` },
        { "@type": "ListItem", position: 3, name: guide.metaTitle.replace(/\s*\|.*$/, ""), item: guideUrl(guide) },
      ] },
      { "@type": "FAQPage", mainEntity: guide.faqs.map(([question, answer]) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
    ],
  };
  return `${shellStart({ ...guide, slug: guide.slug, imageAlt: guide.title })}
  <main>
    <section class="guide-hero"><div class="hero-copy"><p class="eyebrow">${escapeHtml(guide.eyebrow)}</p><h1>${escapeHtml(guide.title)}</h1><p class="lede">${escapeHtml(guide.intro)}</p><div class="hero-actions"><a class="primary" href="${playerUrl(guide)}">Play this atmosphere <span aria-hidden="true">▶</span></a><a href="discover.html">Browse all guides</a></div><p class="privacy-note">No account required · audio-only mode available · mixes stay on your device</p></div><div class="guide-visual"><img src="assets/videos/posters/${guide.poster}.jpg" width="1280" height="720" alt="${escapeHtml(guide.title)}"></div></section>
    <section class="benefit-grid" aria-label="Why use this atmosphere">${guide.benefits.map(([title, detail]) => `<article><span aria-hidden="true"></span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(detail)}</p></article>`).join("")}</section>
    <section class="guide-copy"><p class="eyebrow">Make it yours</p><h2>One atmosphere, many possible rooms</h2><p>${escapeHtml(guide.description)}</p><p>Atmosphere lets you combine several sounds, set individual layer volumes, change the matching video loop, save a mix locally and share a playback configuration. Linked playback keeps the main pause button simple; Data Saver and Audio only reduce unnecessary media transfer.</p><a class="text-link" href="${playerUrl(guide)}">Open ${escapeHtml(guide.metaTitle.replace(/\s*\|.*$/, ""))} in the player <span aria-hidden="true">↗</span></a></section>
    <section class="faq"><p class="eyebrow">Questions</p><h2>About this soundscape</h2>${guide.faqs.map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join("")}</section>
    <section class="related"><div><p class="eyebrow">Keep exploring</p><h2>Related sound guides</h2></div><div class="guide-grid">${related.map((item) => card(item, true)).join("")}</div></section>
  </main>
  <footer><span>© 2026 Atmosphere contributors</span><div><a href="privacy.html">Privacy</a><a href="analytics.html">Analytics</a><a href="audio-credits.html">Media credits</a><a href="./">Open player</a></div></footer>
  <script type="application/ld+json">${json(schema)}</script>
</div></body></html>\n`;
}

function hubPage() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${publicBase}discover.html#webpage`, url: `${publicBase}discover.html`, name: discoveryHub.metaTitle, description: discoveryHub.description, inLanguage: "en-US", dateModified: checkedAt, isPartOf: { "@id": `${publicBase}#website` } },
      { "@type": "ItemList", itemListElement: discoveryGuides.map((guide, index) => ({ "@type": "ListItem", position: index + 1, name: guide.metaTitle.replace(/\s*\|.*$/, ""), url: guideUrl(guide) })) },
    ],
  };
  return `${shellStart({ ...discoveryHub, poster: "space-observation", imageAlt: "Atmosphere ambient sound guides" })}
  <main><section class="hub-hero"><p class="eyebrow">Find your atmosphere</p><h1>Soundscapes for the room you need now</h1><p class="lede">Explore calm, focused and restorative backgrounds, then open the matching atmosphere with its real audio layers and distinct cinematic loops.</p><div class="hero-actions"><a class="primary" href="./">Open the full player <span aria-hidden="true">▶</span></a><a href="#guides">Browse guides</a></div></section>
    <section class="guide-index" id="guides"><div class="section-heading"><p class="eyebrow">Sound guides</p><h2>Start with an intention or a place</h2><p>Each guide explains what the atmosphere contains, how to shape it and which nearby scenes are worth trying next.</p></div><div class="guide-grid">${discoveryGuides.map((guide) => card(guide)).join("")}</div></section>
    <section class="guide-copy centered"><p class="eyebrow">Built for long listening</p><h2>Mix, save, share and step away from the screen</h2><p>Use individual layer volume, smooth crossfades, saved mixes, shareable links, Quiet View and Audio only. Atmosphere requires no account, and personal mixes remain on the current device.</p><a class="text-link" href="./">Create an atmosphere <span aria-hidden="true">↗</span></a></section>
  </main><footer><span>© 2026 Atmosphere contributors</span><div><a href="privacy.html">Privacy</a><a href="analytics.html">Analytics</a><a href="install.html">Install</a><a href="./">Open player</a></div></footer>
  <script type="application/ld+json">${json(schema)}</script>
</div></body></html>\n`;
}

const outputs = new Map([["discover.html", hubPage()], ...discoveryGuides.map((guide) => [`${guide.slug}.html`, guidePage(guide)])]);
for (const [file, expected] of outputs) {
  const target = path.join(publicRoot, file);
  if (checkOnly) {
    const actual = await readFile(target, "utf8");
    if (actual !== expected) throw new Error(`${file} is stale; run npm run seo:generate`);
  } else {
    await writeFile(target, expected);
  }
}
console.log(JSON.stringify({ mode: checkOnly ? "check" : "generate", pages: outputs.size, checkedAt }, null, 2));
