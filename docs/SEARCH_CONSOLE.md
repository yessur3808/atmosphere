# Google Search Console production checklist

Production property: `youratmosphere.app`

## Repository readiness

- `robots.txt` allows crawling and advertises the sitemap.
- `sitemap.xml` uses the production origin during the Cloudflare build.
- Every indexed page has a unique title, description, canonical URL, social preview and primary heading.
- Discovery pages expose `WebPage`, `BreadcrumbList`, `FAQPage` or `ItemList` structured data as appropriate.
- The interactive player, discovery hub and every guide link to one another using ordinary crawlable links.
- Legal, privacy, analytics, accessibility and media-credit pages remain indexed and internally linked.

## One-time account setup

1. In Google Search Console, add a **Domain property** for `youratmosphere.app`.
2. Copy the exact `google-site-verification=...` TXT value supplied by Google.
3. Add that TXT record at the zone apex in Cloudflare DNS. Do not invent or reuse a token from another property.
4. Complete verification in Search Console.
5. Submit `https://youratmosphere.app/sitemap.xml`.
6. Inspect and request indexing for:
   - `https://youratmosphere.app/`
   - `https://youratmosphere.app/discover.html`
   - the ten guide URLs listed in the sitemap
7. Review Page indexing, Core Web Vitals and Enhancements after Google has recrawled the site.

## Weekly review

Track queries, impressions, clicks, click-through rate, average position, indexed-page coverage and Core Web Vitals. Compare search landing pages with Cloudflare Web Analytics reach and consented GA4 playback events; never add those provider totals together.

## Security

The Search Console verification token is not an application secret, but it should still be copied exactly and limited to the intended domain. No Google account credentials, OAuth refresh tokens or Cloudflare API tokens belong in the repository.
