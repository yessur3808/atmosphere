# Atmosphere analytics setup and measurement plan

Atmosphere includes a consent-gated Google Analytics 4 integration in `src/analytics.js`. The Google tag is not requested and no Atmosphere events are sent until a visitor selects **Allow anonymous analytics**.

## Activate GA4

1. In Google Analytics, create a GA4 property and a Web data stream for `https://yessur3808.github.io/atmosphere/`.
2. Copy the stream Measurement ID, which has the form `G-ABC123DEF4`.
3. In `public/index.html`, replace the one placeholder value:

   ```html
   <meta name="google-analytics-id" content="G-XXXXXXXXXX">
   ```

4. Deploy the site. Open Settings → Privacy and confirm the status reads **GA4 ready**.
5. Grant analytics on a test browser and use GA4 Realtime and DebugView to confirm `page_view`, `atmosphere_view`, and interaction events.

The ID is intentionally kept in one meta tag. A GA4 Measurement ID is public configuration, not a secret, and does not grant access to the Analytics property.

## Privacy behavior

- Analytics storage defaults to `denied` before any configuration or event command.
- The Google tag is loaded only after consent.
- Advertising storage, advertising user data, ad personalization, Google Signals, and ad-personalization signals remain disabled.
- Visitors can change their choice under Settings → Privacy.
- No browser geolocation request is made. GA4 provides approximate country/region/city reporting from the network connection and discards the IP before it is logged.
- Do not add names, email addresses, user-entered text, full media URLs, or other personal data to event parameters.

Before enabling production collection, publish a privacy policy naming Google Analytics, the purposes of collection, the retention period, and the visitor's withdrawal controls. Review consent requirements for every market where the site is offered.

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
| `multi_sound_preference` | Multi-layer preference usage |
| `linked_playback_preference` | Unified versus separate transport preference |
| `sound_recipe_apply` | Recipe name and chosen layer combination |
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

Every custom interaction also receives the current `scene_id`, `scene_title`, `track_id`, `active_sound_count`, `video_id`, `playback_mode`, `quiet_view`, and `viewport_bucket` when available.

## Register these GA4 custom definitions

Create event-scoped custom dimensions for:

- `scene_id`
- `scene_title`
- `track_id`
- `video_id`
- `playback_mode`
- `viewport_bucket`
- `control_source`
- `recipe_id`
- `settings_tab`
- `mini_player_mode`
- `metric_name`
- `eligibility_reason`

Create custom metrics for:

- `active_sound_count`
- `active_seconds`
- `listening_seconds`
- `quiet_view_seconds`
- `milestone_seconds`
- `volume_percent`
- `metric_value`

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
