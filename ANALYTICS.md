# Atmosphere analytics setup and measurement plan

Atmosphere includes a consent-gated Google Analytics 4 integration in `src/analytics.js`. The Google tag is not requested and no Atmosphere events are sent until a visitor selects **Allow analytics**.

## Production GA4 stream

- Property: **Atmosphere**
- Web stream: **Atmosphere Website**
- Stream URL: `https://yessur3808.github.io/atmosphere/`
- Measurement ID: `G-EMR3SRND40`
- Enhanced measurement: enabled

The production Measurement ID is configured once in `public/index.html`:

```html
<meta name="google-analytics-id" content="G-EMR3SRND40">
```

After a deployment, open Settings → Privacy & cookies and confirm the status reads **GA4 ready**. Grant analytics in a test browser and use GA4 Realtime and DebugView to confirm `page_view`, `atmosphere_view`, and interaction events.

The ID is intentionally kept in one meta tag. A GA4 Measurement ID is public configuration, not a secret, and does not grant access to the Analytics property.

## Privacy behavior

- Analytics storage defaults to `denied` before any configuration or event command.
- The Google tag is loaded only after consent.
- Global Privacy Control or Do Not Track defaults analytics to denied if no prior choice exists.
- Advertising storage, advertising user data, ad personalization, Google Signals, and ad-personalization signals remain disabled.
- Visitors can change their choice under Settings → Privacy & cookies. Withdrawal activates the GA disable flag and attempts to remove accessible `_ga`, `_gid`, and `_gat*` cookies for the current origin and application path.
- Analytics never requests browser geolocation. GA4 provides approximate country/region/city reporting from the network connection and discards the IP before it is logged.
- The separate, optional header weather feature requests browser location only after a visitor chooses **Add local weather**. Coordinates are rounded to two decimals, kept only in memory, sent only to Open-Meteo, and never added to analytics events. Open-Meteo may retain API logs containing coordinates for up to 90 days under its published terms.
- Do not add names, email addresses, user-entered text, full media URLs, or other personal data to event parameters.

The public `privacy.html`, `cookies.html`, and `analytics.html` pages name Google Analytics, measurement purposes, retention, exclusions, and withdrawal controls. Review consent requirements whenever the offered markets or analytics configuration changes.

## Event inventory

GA4 automatically provides acquisition, device, approximate region, `first_visit`, `session_start`, `page_view`, and `user_engagement`. Atmosphere adds:

| Event | Purpose |
| --- | --- |
| `atmosphere_view` | Initial player view after analytics initialization |
| `atmosphere_select` | Scene choice and whether playback continued |
| `audio_layer_select` | Track/layer choice, removal, and active mix |
| `video_loop_select` | Background loop choice |
| `playback_start`, `playback_pause` | Playback source and unified/separate behavior |
| `video_play`, `video_pause` | Independent video control usage |
| `volume_change` | Committed master-volume level, not every slider movement |
| `layer_volume_change` | Committed volume for an individual active sound layer |
| `multi_sound_preference` | Multi-layer preference usage |
| `smart_mix_preference` | Slowly evolving layer-volume preference usage |
| `data_saver_preference` | Audio-only mode adoption |
| `media_quality_preference`, `media_quality_auto_change` | Manual quality choice and network-driven delivery changes |
| `linked_playback_preference` | Unified versus separate transport preference |
| `sound_recipe_apply` | Recipe name and chosen layer combination |
| `mix_save`, `mix_load`, `mix_favorite`, `mix_delete`, `mix_share` | Local mix-library and privacy-safe share-link adoption |
| `recent_session_record`, `history_resume`, `recent_sessions_clear` | Recent-play and session-resume usefulness |
| `scene_search`, `scene_filter`, `scene_favorite` | Library discovery and scene favorites |
| `sound_recipes_open`, `sound_recipes_close` | Fixed recipe drawer engagement |
| `quiet_view_enter`, `quiet_view_exit` | Distraction-free view adoption |
| `settings_open`, `settings_close`, `settings_tab_view` | Preference discovery and configuration |
| `mini_player_open`, `mini_player_close`, `mini_player_preference` | PiP adoption, mode, and preference |
| `audio_error` | Media reliability by track |
| `engagement_heartbeat` | Visible-page, listening, and quiet-view totals every 60 seconds |
| `listening_milestone` | 1, 5, 15, 30, and 60 minute listening depth |
| `session_summary` | Final active/listening/quiet time sent with beacon transport |
| `web_vital` | LCP, CLS, and INP field performance |
| `monetization_eligible` | A session reaches five minutes of active listening |
| `analytics_consent_update` | Analytics was affirmatively enabled |
| `weather_permission_request` | Visitor explicitly selected Add local weather; no coordinates are attached |
| `weather_enable`, `weather_refresh` | Weather availability and coarse condition, without coordinates or place names |
| `weather_unavailable` | Permission, location, timeout, or forecast failure stage |

Every custom interaction also receives the current `scene_id`, `scene_title`, `track_id`, `active_sound_count`, `video_id`, `playback_mode`, `quiet_view`, `viewport_bucket`, `media_quality_preference`, `video_quality`, `audio_quality`, `connection_type`, and browser Save-Data state when available. Values are categorical; network speed samples or full media URLs are not sent.

## Register these GA4 custom definitions

Create event-scoped custom dimensions for:

- `scene_id`
- `scene_title`
- `track_id`
- `video_id`
- `playback_mode`
- `viewport_bucket`
- `media_quality_preference`
- `video_quality`
- `audio_quality`
- `connection_type`
- `save_data`
- `control_source`
- `recipe_id`
- `settings_tab`
- `mini_player_mode`
- `metric_name`
- `eligibility_reason`
- `weather_condition`
- `failure_stage`

Create custom metrics for:

- `active_sound_count`
- `active_seconds`
- `listening_seconds`
- `quiet_view_seconds`
- `milestone_seconds`
- `volume_percent`
- `metric_value`
- `weather_temperature_c`

Avoid registering duplicate definitions for parameters GA4 already provides, such as page title, page path, device category, city, country, session duration, and engagement time.

## Recommended explorations

### Product engagement

- Rows: `scene_title`, `track_id`, `video_id`
- Values: active users, sessions, event count, average engagement time, `listening_seconds`
- Segments: phone/tablet/desktop and new/returning users

This shows which atmospheres deserve more media investment and which media is selected but abandoned quickly.

### Retention and listening depth

- Funnel: `session_start` → `playback_start` → one-minute milestone → five-minute milestone → fifteen-minute milestone
- Break down by acquisition channel, device category, country, and atmosphere.

### Feature value

Compare listening time and return rate for sessions containing:

- `sound_recipe_apply`
- `quiet_view_enter`
- `mini_player_open`
- more than one active sound

Features associated with longer listening sessions are candidates for premium enhancements rather than advertising space.

### Monetization readiness

Use `monetization_eligible` as the base audience. Measure:

- eligible sessions per active user
- eligible-session share by device and country
- average listening time after the five-minute point
- return rate for eligible versus non-eligible visitors
- quiet-view and PiP adoption among eligible listeners

A subtle ad experiment should report future `ad_impression`, `ad_click`, `ad_close`, and `ad_feedback` events plus placement and experiment variant. Compare listening time, bounce/exit rate, recipe use, and return rate against a no-ad control. Do not judge the experiment from click-through rate alone.

## Monetization decision rule

Only scale an ad or paid experiment when incremental revenue per 1,000 sessions is positive **and** the experiment does not materially reduce:

- five- and fifteen-minute listening completion
- seven- or twenty-eight-day return rate
- quiet-view or PiP adoption
- playback starts per session

A practical first guardrail is to reject a placement if it reduces five-minute listening completion by more than 3–5%, even when click-through revenue is positive.
