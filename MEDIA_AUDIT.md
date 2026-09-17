# Atmosphere media audit

Audit completed 2026-09-17. The catalog contains 22 atmospheres, 110 audio choices, and 88 rendered video choices.

## Method

- Checked every audio choice against its source-page title, description, creator, license, and recording context.
- Checked every video choice against its source description and a representative decoded frame.
- Distinguished exact recordings from useful supporting layers. Supporting layers remain only when their labels describe what is actually heard or seen.
- Rejected music, unrelated environments, misleading time-of-day labels, generic noise presented as a real room, and scenery without the named weather or place.

## Results by atmosphere

| Atmosphere | Audio | Video | Audit result |
| --- | --- | --- | --- |
| Rain | 5/5 | 4/4 | Pass |
| Coffee shop | 5/5 | 4/4 | Pass |
| Waterfall | 5/5 | 4/4 | Pass; forest waterfall is a verified Iguazu Falls recording |
| Lightning | 5/5 | 4/4 | Pass |
| Wind | 5/5 | 4/4 | Pass |
| Fire | 5/5 | 4/4 | Corrected the ambiguous crackle with a documented stone-hearth recording |
| Snow | 5/5 | 4/4 | Corrected three misleading audio labels and replaced three weak mountain clips with visible snowfall |
| Night street | 5/5 | 4/4 | Corrected a false midnight label to a time-neutral city crossing |
| Leaves | 5/5 | 4/4 | Pass; canopy audio is a real leaves-in-wind field recording |
| Ocean | 5/5 | 4/4 | Replaced inland lake waves with verified North Atlantic surf |
| Train | 5/5 | 4/4 | Pass; station, track, and tunnel variants are intentional supporting views |
| Typing | 5/5 | 4/4 | Replaced a mixed chat/setup recording with uninterrupted keyboard typing |
| Footsteps | 5/5 | 4/4 | Pass; corrected the forest-track label |
| Birds | 5/5 | 4/4 | Pass; corrected the nightingale recording label |
| Soft static | 5/5 | 4/4 | Pass; corrected violet noise's tonal description |
| Japanese onsen | 5/5 | 4/4 | Replaced three generic audio layers with hot-spring, suikinkutsu, and warm-water recordings; replaced rooftop pool, geyser, and fountain videos with genuine Japanese onsen locations |
| Cat by the window | 5/5 | 4/4 | Pass as a cozy-cat set; replaced the garden-eating clip with cats actively watching through a window |
| Quiet library | 5/5 | 4/4 | Replaced generic gray noise with TU Delft Library room tone; corrected the hearth source |
| Forest | 5/5 | 4/4 | Pass |
| Jungle | 5/5 | 4/4 | Replaced temperate birds, spruce wind, and nightingale audio with Amazon toucans and two Thailand jungle field recordings |
| Beach / shore | 5/5 | 4/4 | Pass |
| Traffic | 5/5 | 4/4 | Pass; corrected a false evening label to a time-neutral city-traffic label |

## Ongoing safeguards

- Runtime media catalogs are generated from a complete 22-atmosphere source catalog.
- Tests require five audio choices and four distinct video choices per atmosphere.
- Tests verify local replacement files exist, reject the known incorrect sources, enforce the corrected snow/onsen/jungle mappings, and keep every published file below GitHub's 100 MB per-file limit.
- Audio and video credit pages link to the original recordings and their licenses.
