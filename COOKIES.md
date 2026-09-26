# Cookie and local-storage policy

Effective: 27 September 2026

Atmosphere uses essential browser storage for requested app functions and optional Google Analytics cookies only after consent.

## Essential local storage

These records are stored only in the browser or desktop WebView and are not transmitted to an Atmosphere server:

| Key or group | Purpose | Typical retention |
| --- | --- | --- |
| `atmosphere-analytics-consent-v1` | Remembers allow/reject choice | Until changed or site data is cleared |
| `atmosphere-preferences-v2` | Playback, quality, weather, and display settings | Until cleared |
| `atmosphere-saved-mixes-v1` | User-saved mixes | Until individually removed or cleared |
| `atmosphere-recent-mixes-v1` | Recent listening sessions | Until cleared; app limits the list |
| `atmosphere-favorite-scenes-v1` | Favorite atmospheres | Until cleared |
| `atmosphere-resume-v1` | Last-session resume state | Replaced as playback changes or until cleared |
| `atmosphere-pip-preference` and UI-state keys | Mini-player and interface preferences | Until changed or cleared |

Shared-mix configuration is placed in the URL only when a user requests a share link.

## Optional analytics cookies

After **Allow analytics**, Google Analytics may set `_ga` and a property-specific `_ga_*` cookie to distinguish browser sessions and users for measurement. Atmosphere configures these cookies for approximately thirteen months. `_gid` or `_gat*` may appear if Google changes tag behavior; they are treated as analytics cookies. Advertising storage, ad personalization, and Google Signals remain disabled.

Rejecting or withdrawing analytics prevents Atmosphere custom events, sends a denied consent state, activates the GA disable flag, and deletes accessible `_ga`, `_gid`, and `_gat*` cookies for the current host and application path. Browser or provider restrictions can prevent script-level deletion of a cookie created outside the accessible scope; browser site-data controls remain the authoritative fallback.

## Controls

Use **Settings → Privacy & cookies** to allow or reject analytics. Browser settings can remove all cookies and local storage. Global Privacy Control or Do Not Track defaults analytics to denied when the user has not already made a choice. Essential local storage is not used for advertising or cross-site tracking.
