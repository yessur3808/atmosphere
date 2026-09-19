# Atmosphere media audit

Audit updated 2026-09-19. The catalog contains 29 atmospheres, 155 audio choices, and 126 rendered video choices.

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
| Snow | 6/6 | 4/4 | Corrected three misleading audio labels and replaced three weak mountain clips with visible snowfall; added a verified cabin-hearth layer |
| Night street | 5/5 | 4/4 | Corrected a false midnight label to a time-neutral city crossing |
| Leaves | 5/5 | 4/4 | Pass; canopy audio is a real leaves-in-wind field recording |
| Ocean | 5/5 | 4/4 | Replaced inland lake waves with verified North Atlantic surf |
| Train | 7/7 | 4/4 | Pass; station, track, tunnel, rain, and passing-road layers are intentional supporting choices |
| Typing | 7/7 | 4/4 | Replaced a mixed chat/setup recording with uninterrupted keyboard typing; added brown-noise and distant-office layers for the focus recipe |
| Footsteps | 5/5 | 4/4 | Pass; corrected the forest-track label |
| Birds | 5/5 | 4/4 | Pass; corrected the nightingale recording label |
| Soft static | 5/5 | 4/4 | Pass; corrected violet noise's tonal description |
| Japanese onsen | 5/5 | 4/4 | Replaced three generic audio layers with hot-spring, suikinkutsu, and warm-water recordings; replaced rooftop pool, geyser, and fountain videos with genuine Japanese onsen locations |
| Cat by the window | 5/5 | 4/4 | Pass as a cozy-cat set; replaced the garden-eating clip with cats actively watching through a window |
| Quiet library | 6/6 | 4/4 | Replaced generic gray noise with TU Delft Library room tone; corrected the hearth source and added a verified window-rain layer |
| Forest | 5/5 | 4/4 | Pass |
| Jungle | 5/5 | 4/4 | Replaced temperate birds, spruce wind, and nightingale audio with Amazon toucans and two Thailand jungle field recordings |
| Beach / shore | 5/5 | 4/4 | Pass |
| Traffic | 5/5 | 4/4 | Pass; corrected a false evening label to a time-neutral city-traffic label |
| Elevator music | 6/6 | 4/4 | Pass; five CC BY lounge instrumentals, a reusable lobby-room layer, real moving hotel elevators, and a glass-lift POV |
| Rainy bedroom | 6/6 | 4/4 | Pass; room-specific rain, quiet interior, fire, and distant-city layers with bedroom and window views |
| Brown noise | 5/5 | 4/4 | Pass; five accurately named spectral choices with slow abstract visuals |
| Spaceship observation deck | 6/6 | 4/4 | Pass; ventilation, electrical hum, Voyager plasma, static, and NASA cosmology audio with four space-specific views |
| Night drive | 5/5 | 14/14 | Pass; genuine in-car, windshield, highway, tunnel, rural, winter, coastal, and city views spanning Dubai, Seoul, Los Angeles, and Shenzhen |
| City apartment at night | 6/6 | 4/4 | Pass; distant city, rain, room, neighbour, and ventilation layers with four skyline/window views |
| Farm | 5/5 | 4/4 | Pass; real barnyard, chicken, sheep-field, tractor, and field-bird recordings with livestock and crop footage |

## Ongoing safeguards

- Runtime media catalogs are generated from a complete 29-atmosphere source catalog.
- Tests require five to eight audio choices and four distinct video choices per atmosphere, with a dedicated 14-view requirement for Night Drive.
- Tests verify local replacement files exist, reject the known incorrect sources, enforce the corrected snow/onsen/jungle mappings, and keep every published file below GitHub's 100 MB per-file limit.
- Audio and video credit pages link to the original recordings and their licenses.
