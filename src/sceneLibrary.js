import tabsData from "./tabsData.json";
import audioSources from "../audio-sources.json";
import videoSources from "./videoLoops.resolved.json";
import mediaVariants from "./mediaVariants.json";
import { mediaUrl } from "./siteUrl.mjs";

const meta = {
  tab_rain: ["Rain", "Weather", "Soft rain settling against the window.", "#83b7d2", "131, 183, 210"],
  tab_coffee_shop: ["Coffee shop", "Everyday", "A warm corner with a gentle social rhythm.", "#d79c68", "215, 156, 104"],
  tab_waterfall: ["Waterfall", "Water", "Cool, continuous movement for clear focus.", "#70c4b8", "112, 196, 184"],
  tab_lightning: ["Lightning", "Weather", "A charged horizon and distant storm light.", "#a59adc", "165, 154, 220"],
  tab_wind: ["Wind", "Air", "Long, open movement across a quiet landscape.", "#a6c6cb", "166, 198, 203"],
  tab_fire: ["Fire", "Warmth", "A low glow for settling in and slowing down.", "#ef8d4d", "239, 141, 77"],
  tab_snow: ["Snow", "Weather", "A muted winter scene with room to think.", "#c2dfef", "194, 223, 239"],
  tab_street: ["Night street", "City", "Passing light after the city quiets.", "#9485cf", "148, 133, 207"],
  tab_leaves: ["Leaves", "Nature", "A moving canopy for an easy, grounded pause.", "#8cb56f", "140, 181, 111"],
  tab_ocean_waves: ["Ocean", "Water", "An open horizon with a repeating natural pace.", "#55a8d0", "85, 168, 208"],
  tab_train: ["Train", "Transit", "A private window in steady motion.", "#c79269", "199, 146, 105"],
  tab_typing: ["Typing", "Focus", "A concentrated desk rhythm for deep work.", "#91a9c0", "145, 169, 192"],
  tab_foot_steps: ["Footsteps", "Movement", "An evening walk with nowhere to be.", "#c59d76", "197, 157, 118"],
  tab_birds: ["Birds", "Nature", "Early light and small movement in the branches.", "#b9c767", "185, 199, 103"],
  tab_white_noise: ["Soft static", "Focus", "A quiet field with nothing asking for attention.", "#bac2cb", "186, 194, 203"],
  tab_onsen: ["Japanese onsen", "Retreat", "Steam, flowing water, and a quiet garden ritual.", "#9bc7b0", "155, 199, 176"],
  tab_cat_window: ["Cat by the window", "Home", "A sleepy companion beside rain-softened glass.", "#d6a37d", "214, 163, 125"],
  tab_library: ["Quiet library", "Focus", "Pages, soft footsteps, and a room built for deep thought.", "#c6a36e", "198, 163, 110"],
  tab_forest: ["Forest", "Nature", "Moss, branches, birds, and air moving beneath tall trees.", "#6fa77c", "111, 167, 124"],
  tab_jungle: ["Jungle", "Nature", "Dense tropical life layered with rain, birds, and falling water.", "#55ad7a", "85, 173, 122"],
  tab_beach_shore: ["Beach / shore", "Water", "Waves folding onto sand beneath an open coastal sky.", "#66bfd0", "102, 191, 208"],
  tab_traffic: ["City sounds", "City", "Layer the broad, living current of streets, roads, and passing urban light.", "#d08f68", "208, 143, 104"],
  tab_elevator_music: ["Elevator music", "Transit", "A never-ending ride through polished lobbies and glowing floors.", "#d6b06f", "214, 176, 111"],
  tab_rainy_bedroom: ["Rainy bedroom", "Home", "A warm room, softened light, and rain settling against the glass.", "#7f9db6", "127, 157, 182"],
  tab_brown_noise: ["Brown noise", "Focus", "A deep, even sound bed that leaves the rest of the room alone.", "#a47d62", "164, 125, 98"],
  tab_space_observation: ["Spaceship observation deck", "Space", "Life-support hum and a wide view beyond the edge of Earth.", "#788ce0", "120, 140, 224"],
  tab_night_drive: ["Night drive", "Transit", "Wet roads, dashboard glow, and an unhurried route through the dark.", "#c5688f", "197, 104, 143"],
  tab_city_apartment: ["City apartment at night", "City", "A private room above the distant current of the city.", "#9b82cf", "155, 130, 207"],
  tab_farm: ["Farm", "Countryside", "Open fields, barnyard life, and the slow rhythm of a country morning.", "#9fb16c", "159, 177, 108"],
};

const sceneSubcategories = {
  tab_traffic: [
    {
      id: "traffic",
      title: "Traffic",
      description: "Roads, intersections, engines, and tyres moving through the city.",
      trackIndices: [0, 1, 2, 3, 4],
      videoIndices: [0, 1, 2, 3],
    },
  ],
};

// Every active background now comes from the source-tracked video catalog.
// Legacy root videos remain outside the runtime mapping and can be removed
// without reducing the four-view collection for standard atmospheres.
const remoteFirstScenes = new Set(tabsData.map(({ id }) => id));

function withoutExtension(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

export const scenes = tabsData.map((scene) => {
  const [title, category, description, accent, accentRgb] = meta[scene.id] || [scene.title, "Atmosphere", scene.description, "#a9bfd0", "169, 191, 208"];
  const mediaName = withoutExtension(scene.background);
  const sourcedLoops = videoSources[scene.id] || [];
  const replacesLegacyOriginal = remoteFirstScenes.has(scene.id);
  const originalSource = replacesLegacyOriginal ? sourcedLoops[0] : null;
  const alternateLoops = replacesLegacyOriginal ? sourcedLoops.slice(1) : sourcedLoops;
  const subcategories = sceneSubcategories[scene.id] || [];
  const subcategoryFor = (index, key) => subcategories.find((subcategory) => subcategory[key].includes(index))?.id;
  return {
    ...scene,
    title,
    category,
    description,
    accent,
    accentRgb,
    subcategories,
    audioTracks: audioSources[scene.id].map((track, index) => {
      const relativeSource = String(track.src || `assets/audio/${scene.id.replace(/^tab_/, "")}/${track.file}`).replace(/^\//, "");
      const efficientSource = relativeSource
        .replace(/^assets\/audio\//, "assets/audio-low/")
        .replace(/\.[^.]+$/, ".mp3");
      return {
        ...track,
        id: `${scene.id}-audio-${index}`,
        src: mediaUrl(relativeSource),
        efficientSrc: mediaUrl(efficientSource),
        subcategory: subcategoryFor(index, "trackIndices"),
      };
    }),
    videoLoops: [
      {
        id: `${scene.id}-video-0`,
        title: originalSource?.title || "Original scene",
        background: originalSource ? mediaUrl(originalSource.high) : scene.background,
        adaptiveBackground: originalSource ? mediaUrl(originalSource.adaptive) : `adaptive/${mediaName}-720.mp4`,
        webmBackground: originalSource && mediaVariants.videoWebm[originalSource.high]
          ? mediaUrl(mediaVariants.videoWebm[originalSource.high])
          : "",
        poster: `posters/${mediaName}.jpg`,
        source: originalSource?.source,
        start: 0,
        playbackRate: 1,
        scale: 1.025,
        position: "50% 50%",
        subcategory: subcategoryFor(0, "videoIndices"),
      },
      ...alternateLoops.map((loop, index) => ({
        id: `${scene.id}-video-${index + 1}`,
        title: loop.title,
        background: mediaUrl(loop.high),
        adaptiveBackground: mediaUrl(loop.adaptive),
        webmBackground: mediaVariants.videoWebm[loop.high]
          ? mediaUrl(mediaVariants.videoWebm[loop.high])
          : "",
        poster: `posters/${mediaName}.jpg`,
        source: loop.source,
        start: 0,
        playbackRate: 1,
        scale: 1.025,
        position: "50% 50%",
        subcategory: subcategoryFor(index + 1, "videoIndices"),
      })),
    ],
  };
});
