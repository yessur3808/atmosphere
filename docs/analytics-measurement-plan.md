# Atmosphere analytics measurement plan

## Purpose

Use GA4 to answer product questions without collecting names, account identifiers, precise location, city searches, saved-mix names, or raw shared-mix payloads. Analytics remains consent-gated and advertising features remain disabled.

## North-star and supporting measures

- **Meaningful listeners:** users who reach `meaningful_listening` after five audible minutes.
- **Retained listeners:** users who reach `retained_listening` after fifteen audible minutes.
- **Listening time:** sum of `listening_interval_seconds` on `listening_interval`; never sum the cumulative heartbeat fields.
- **Creation:** `mix_save`, `mix_share`, and `sound_recipe_apply` users and event counts.
- **Discovery:** atmosphere selections, searches, filters, and weather matches that lead to playback.
- **Quality:** playback errors, weather failures, and Web Vitals.

## Dashboard: Atmosphere — Product & Listening

GA4 dashboard ID: `15848920631`. Use a rolling 28-day range and compare with the previous period when reviewing a decision.

The saved dashboard contains ten decision-oriented cards:

1. Active users.
2. Listening interval seconds.
3. Key events.
4. Engagement rate.
5. Active users over time.
6. Top atmospheres by listening time.
7. Feature and event usage.
8. Top sound layers by listening time.
9. Users by acquisition channel.
10. Users by device category.

Use Explorations for deeper questions that need more breakdowns: recipe applications by Recipe title, discovery by Selection source, feature adoption by App surface and Viewport bucket, Web Vitals by Display mode, and the activation funnel below.

## Custom dimensions

Register these as event-scoped dimensions. Display names intentionally match the dashboard vocabulary.

| Display name | Event parameter |
| --- | --- |
| Analytics schema | `analytics_schema` |
| App surface | `app_surface` |
| Display mode | `display_mode` |
| Viewport bucket | `viewport_bucket` |
| Scene ID | `scene_id` |
| Scene title | `scene_title` |
| Scene category | `scene_category` |
| Sound category | `sound_category` |
| Track IDs | `track_id` |
| Track type | `track_type` |
| Video ID | `video_id` |
| Playback mode | `playback_mode` |
| Data saver | `data_saver` |
| Smart Mix | `smart_mix` |
| Live Weather | `live_weather` |
| Quiet view | `quiet_view` |
| Control source | `control_source` |
| Selection source | `selection_source` |
| Recipe ID | `recipe_id` |
| Recipe title | `recipe_title` |
| Mix source | `mix_source` |
| Weather condition | `weather_condition` |
| Weather mode | `weather_mode` |
| Interval reason | `interval_reason` |
| Web vital | `metric_name` |
| Metric unit | `metric_unit` |

## Custom metrics

Register these as event-scoped metrics with the Standard unit unless stated otherwise.

| Display name | Event parameter | Unit |
| --- | --- | --- |
| Listening interval seconds | `listening_interval_seconds` | Seconds |
| Session active seconds | `session_active_seconds` | Seconds |
| Session listening seconds | `session_listening_seconds` | Seconds |
| Session quiet view seconds | `session_quiet_seconds` | Seconds |
| Playback starts per session | `playback_starts` | Standard |
| Scene changes per session | `scene_changes` | Standard |
| Track changes per session | `track_changes` | Standard |
| Mix actions per session | `mix_actions` | Standard |
| Discovery actions per session | `discovery_actions` | Standard |
| Feature actions per session | `feature_actions` | Standard |
| Errors per session | `error_count` | Standard |
| Unique scenes per session | `unique_scene_count` | Standard |
| Unique tracks per session | `unique_track_count` | Standard |
| Active sound count | `active_sound_count` | Standard |
| Web vital value | `metric_value` | Standard; filter by Web vital and Metric unit |

## Key events and funnels

Mark `meaningful_listening`, `retained_listening`, `mix_save`, `mix_share`, and `pwa_install_complete` as key events. Keep `playback_start` as the activation step, not a key event.

Primary open funnel:

1. `page_view`
2. `playback_start`
3. `meaningful_listening`
4. Any of `mix_save`, `mix_share`, or `pwa_install_complete`

Use Scene title, App surface, Viewport bucket, and Session primary channel group as breakdowns. Review weekly until traffic supports stable comparisons, then use 28-day and 90-day views.

## Interpretation rules

- Use `listening_interval_seconds` for total listening by atmosphere, track, video, recipe state, and feature state.
- Use `session_listening_seconds` only on `session_summary`; do not sum `listening_seconds` from heartbeats.
- Prefer users or sessions over raw event count when comparing feature adoption because repeated controls can generate multiple events.
- Custom definitions apply prospectively and can take 24–48 hours to become available in reporting.
- Do not register high-cardinality URLs, shared-mix payloads, user-entered mix names, or city-search text.

## QA

- Validate consent before the Google tag loads.
- Use Realtime and DebugView after each event-schema change.
- Compare a timed five-minute listening session with `meaningful_listening` and interval totals.
- Confirm page URLs replace shared mix payloads with `mix=shared`.
- Check custom-definition quota before adding new fields and archive definitions that no longer inform a decision.
