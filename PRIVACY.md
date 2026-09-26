# Privacy policy

Effective: 27 September 2026

This policy explains how the maintainers of the Atmosphere project ("Atmosphere", "we", or "us") handle information in the web and desktop applications. Contact is available through <https://github.com/yessur3808/atmosphere/issues>; do not post sensitive information and request a private channel when needed.

## Summary

Atmosphere has no account system, advertising SDK, payment processor, or project-operated user database. Preferences and mixes remain on the device. Google Analytics 4 loads only after affirmative consent. Rejecting or withdrawing consent blocks Atmosphere analytics events and removes accessible Google Analytics cookies. Precise weather coordinates and city-search text are never sent to Google Analytics.

## Information and purposes

### Essential device storage

Browser or WebView local storage keeps consent, settings, saved and recent mixes, favorites, playback state, and resume information. This provides requested functionality and is not synchronized to an Atmosphere server. Records remain until the user removes them, clears site/application data, or uninstalls the app. Shared mixes are encoded in the generated URL; anyone with the link can read its playback configuration.

### Optional analytics

After consent, Google Analytics 4 receives page and screen context, atmosphere/track/video identifiers, playback and feature interactions, non-cumulative listening intervals, engagement milestones, coarse viewport and connection categories, selected media quality, performance measurements, referrer, browser, operating system, timestamps, and an approximate region derived by Google from the network connection. Google may process the request IP address to provide the service.

Atmosphere does not send names, email addresses, account identifiers, custom mix names, shared-mix contents, city-search text, or weather coordinates. Google Signals, advertising storage, ad-user-data consent, and ad personalization remain disabled. GA cookies are limited to approximately thirteen months; GA4 event-level data is configured for up to fourteen months, while aggregate reporting can remain longer. See [ANALYTICS.md](ANALYTICS.md) and [COOKIES.md](COOKIES.md).

Analytics relies on consent. It can be rejected initially or changed at any time under **Settings → Privacy & cookies**. Withdrawal stops future Atmosphere event collection and attempts to remove GA cookies on the current origin, but it cannot remove information already processed or aggregated by Google.

### Optional weather

Weather stays off until the user selects local weather or searches for a place. With device location permission, coordinates are rounded to two decimal places and sent directly to Open-Meteo. A manual search sends the entered text to Open-Meteo's geocoding service. Atmosphere retains the selected location only in memory and has no location database. Open-Meteo states that free-API server logs can contain IP addresses and coordinates and are deleted after 90 days.

## Providers and international processing

- **GitHub** hosts the website, source, releases, and installation files and may keep security and request logs.
- **Google Analytics** processes consented usage measurement as a service provider.
- **Open-Meteo** processes requested weather and place-search requests.
- **Coverr, Pexels, and Wikimedia Commons** provide or document credited media. Some video may be requested from a provider CDN.

Providers can process data outside the user's country under their own terms and transfer safeguards. Atmosphere does not sell personal information or share it for cross-context behavioral advertising.

## Choices and rights

Users can reject or withdraw analytics, decline location, clear application storage, remove saved mixes, avoid sharing mix links, and enable browser Global Privacy Control or Do Not Track; when no prior analytics choice exists, either signal defaults analytics to denied. Depending on location, users may have rights to access, correct, delete, restrict, port, or object to processing, withdraw consent, and complain to a data-protection authority. Because Atmosphere has no accounts and intentionally avoids direct identifiers, maintainers may be unable to associate GA data with a particular person.

## Children, security, and changes

Atmosphere is not directed to children under 13. Where local law requires an older age for independent consent, analytics should remain disabled unless a parent or guardian provides the required permission. Reasonable safeguards are used, but no networked service is risk-free. Security reports should follow [SECURITY.md](SECURITY.md). Material changes update the effective date and published links.
