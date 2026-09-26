# Atmosphere production launch plan

## Recommended target architecture

- Keep GitHub as the source of truth and keep pull-request checks as the release gate.
- Deploy the versioned static app shell to Cloudflare Workers Static Assets behind a custom production domain; create a separate staging hostname and GA4 web stream.
- Serve frequently used audio and poster images from Cloudflare R2 Standard through a media subdomain with immutable filenames, range requests, long-lived cache headers, CORS limited to the production and staging origins, and lifecycle rules for retired media.
- Evaluate Cloudflare Stream for video only after measuring real traffic. Its adaptive bitrate delivery can improve weak-network playback, but looping backgrounds may be cheaper from pre-encoded R2 objects when browser caching is effective.
- Keep GitHub Pages as a temporary preview and rollback reference, not the long-term media origin. Its published-site and recommended repository limit is 1 GB and its soft bandwidth limit is 100 GB per month.

## 1. Product and brand foundation

- Choose a distinctive product name and register its primary domain plus the closest defensive variant.
- Run trademark and social-handle checks before investing in promotion.
- Put the production domain on the website, GA4 stream, canonical URLs, social metadata, desktop updater, legal pages, and email identities.

## 2. Production delivery architecture

- Keep the web application as a static, versioned build behind a global CDN.
- Move large audio and video files out of the Git repository into object storage with CDN delivery, immutable filenames, range requests, and correct media content types.
- Generate AV1/WebM and H.264 fallbacks, multiple video resolutions, poster images, and normalized audio variants. Select sources using device capability and measured network quality.
- Add a staging domain with a separate GA4 property or stream so development traffic never pollutes production analytics.

## 3. Reliability and security

- Enforce HTTPS, HSTS, a tested Content Security Policy, restrictive permissions policy, dependency scanning, provenance, and signed desktop releases.
- Add synthetic uptime checks for the application shell, representative audio/video assets, weather service, and release downloads.
- Add client-side error reporting with consent-aware redaction and release versions.
- Define rollback, media takedown, incident response, backup, and provider-outage procedures.

## 4. Privacy and compliance

- Replace project-owner details and effective dates in legal documents before launch.
- Add a durable consent-management policy appropriate to target regions and keep advertising consent disabled until monetization is actually introduced.
- Complete a media-license audit with source URLs, permitted uses, attribution requirements, and archival proof.
- Publish support, privacy, security, accessibility, and copyright-contact channels on the production domain.

## 5. Discovery and launch

- Submit the production sitemap to Google Search Console and Bing Webmaster Tools.
- Create a branded social preview, web-app screenshots, structured data, favicon set, and a short landing explanation for non-JavaScript and search visitors.
- Publish useful indexable pages around focus, sleep, weather ambience, city soundscapes, and individual atmosphere collections without turning the player into a content-heavy interface.
- Launch to a small invited cohort first, fix activation and media-delivery issues, then expand through communities, creator partnerships, newsletters, and search content.

## 6. Product gates

- **Private beta:** reliable playback, correct licensing, consent, monitoring, and no critical accessibility failures.
- **Public beta:** custom domain, production CDN, staging isolation, support channel, analytics dashboard, and tested rollback.
- **General availability:** stable seven-day playback success, acceptable Core Web Vitals, proven media costs, repeat listeners, and a documented incident process.

Do not introduce advertising until the dashboard shows durable repeat listening and enough session depth to support it without harming the calm experience.

## Migration sequence

1. **Production readiness audit** — finalize the name/domain, audit media licenses, replace legal placeholders, run accessibility/security/performance checks, and set launch thresholds.
2. **Infrastructure** — create production and staging deployments, media storage, cache/CORS/security headers, uptime/error monitoring, and a one-command rollback.
3. **Media migration** — upload fingerprinted audio/video, publish a manifest, test range requests and fallbacks, then switch one atmosphere at a time while comparing playback errors and start latency.
4. **Domain cutover** — connect the custom domain, update canonical/social/structured metadata and the GA4 stream, preserve redirects, and validate the sitemap and robots file.
5. **Private beta** — invite a small multi-device cohort; review activation, five- and fifteen-minute listening, errors, Core Web Vitals, and bandwidth cost every day.
6. **Public launch** — submit the production sitemap in Search Console, publish indexable atmosphere pages, expand distribution gradually, and review the GA4 product dashboard weekly.

Before public launch, record baselines and targets for playback-start success, median media start latency, five-minute listening conversion, fifteen-minute retention, seven-day returning listeners, error-free sessions, LCP/INP/CLS, and media cost per listening hour.
