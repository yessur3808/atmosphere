export const mixStateVersion = 1;
export const maximumSavedMixes = 30;
export const maximumRecentMixes = 6;

export function clampUnit(value, fallback = 1) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.min(1, numericValue));
}

function cleanString(value, maximumLength = 80) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function findScene(sceneId, scenes) {
  return scenes.find((scene) => scene.id === sceneId) || scenes[0];
}

export function normalizeMixSnapshot(value, scenes) {
  if (!value || typeof value !== "object" || !Array.isArray(scenes) || !scenes.length) return null;
  const scene = findScene(cleanString(value.sceneId), scenes);
  if (!scene) return null;

  const availableTrackIds = new Set(scene.audioTracks.map((track) => track.id));
  const requestedTrackIds = Array.isArray(value.trackIds) ? value.trackIds : [];
  const trackIds = [...new Set(requestedTrackIds.filter((trackId) => availableTrackIds.has(trackId)))].slice(0, scene.audioTracks.length);
  if (!trackIds.length && scene.audioTracks[0]) trackIds.push(scene.audioTracks[0].id);

  const availableVideoIds = new Set(scene.videoLoops.map((loop) => loop.id));
  const videoId = availableVideoIds.has(value.videoId) ? value.videoId : scene.videoLoops[0]?.id || "";
  const layerVolumes = {};
  for (const trackId of trackIds) {
    layerVolumes[trackId] = clampUnit(value.layerVolumes?.[trackId], trackIds.length > 1 ? 0.72 : 1);
  }

  return {
    version: mixStateVersion,
    id: cleanString(value.id, 120),
    name: cleanString(value.name, 64),
    sceneId: scene.id,
    trackIds,
    layerVolumes,
    videoId,
    masterVolume: clampUnit(value.masterVolume, 0.52),
    smartMixEnabled: Boolean(value.smartMixEnabled),
    multiSoundEnabled: trackIds.length > 1 || Boolean(value.multiSoundEnabled),
    linkedPlayback: value.linkedPlayback !== false,
    dataSaverMode: Boolean(value.dataSaverMode),
    favorite: Boolean(value.favorite),
    savedAt: Number.isFinite(Number(value.savedAt)) ? Number(value.savedAt) : Date.now(),
    usedAt: Number.isFinite(Number(value.usedAt)) ? Number(value.usedAt) : Date.now(),
  };
}

export function toShareableMix(snapshot, scenes) {
  const normalized = normalizeMixSnapshot(snapshot, scenes);
  if (!normalized) return null;
  return {
    v: mixStateVersion,
    s: normalized.sceneId,
    t: normalized.trackIds,
    l: normalized.layerVolumes,
    b: normalized.videoId,
    m: normalized.masterVolume,
    x: normalized.smartMixEnabled ? 1 : 0,
    u: normalized.multiSoundEnabled ? 1 : 0,
    p: normalized.linkedPlayback ? 1 : 0,
    d: normalized.dataSaverMode ? 1 : 0,
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(value) {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function encodeMixSnapshot(snapshot, scenes) {
  const shareable = toShareableMix(snapshot, scenes);
  if (!shareable) return "";
  const base64 = bytesToBase64(new TextEncoder().encode(JSON.stringify(shareable)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeMixSnapshot(value, scenes) {
  if (typeof value !== "string" || !value || value.length > 5000) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const compact = JSON.parse(new TextDecoder().decode(base64ToBytes(padded)));
    if (compact.v !== mixStateVersion) return null;
    return normalizeMixSnapshot({
      sceneId: compact.s,
      trackIds: compact.t,
      layerVolumes: compact.l,
      videoId: compact.b,
      masterVolume: compact.m,
      smartMixEnabled: compact.x === 1,
      multiSoundEnabled: compact.u === 1,
      linkedPlayback: compact.p !== 0,
      dataSaverMode: compact.d === 1,
    }, scenes);
  } catch (error) {
    return null;
  }
}

export function filterSceneLibrary(scenes, query = "", category = "all", favoriteSceneIds = []) {
  const normalizedQuery = cleanString(query, 120).toLocaleLowerCase();
  const favoriteSet = new Set(favoriteSceneIds);
  return scenes.filter((scene) => {
    if (category === "favorites" && !favoriteSet.has(scene.id)) return false;
    if (category !== "all" && category !== "favorites" && scene.category !== category) return false;
    if (!normalizedQuery) return true;
    const searchableText = [
      scene.title,
      scene.category,
      scene.description,
      ...(scene.subcategories || []).flatMap((subcategory) => [subcategory.title, subcategory.description]),
      ...scene.audioTracks.flatMap((track) => [track.title, track.note]),
    ].join(" ").toLocaleLowerCase();
    return searchableText.includes(normalizedQuery);
  });
}

export function upsertRecentMix(recentMixes, snapshot, scenes, maximum = maximumRecentMixes) {
  const normalized = normalizeMixSnapshot({ ...snapshot, usedAt: Date.now() }, scenes);
  if (!normalized) return Array.isArray(recentMixes) ? recentMixes : [];
  const signature = `${normalized.sceneId}:${normalized.trackIds.join(",")}:${normalized.videoId}`;
  const existing = (Array.isArray(recentMixes) ? recentMixes : [])
    .map((mix) => normalizeMixSnapshot(mix, scenes))
    .filter(Boolean)
    .filter((mix) => `${mix.sceneId}:${mix.trackIds.join(",")}:${mix.videoId}` !== signature);
  return [normalized, ...existing].slice(0, maximum);
}

export function sortSavedMixes(savedMixes, scenes) {
  return (Array.isArray(savedMixes) ? savedMixes : [])
    .map((mix) => normalizeMixSnapshot(mix, scenes))
    .filter(Boolean)
    .sort((first, second) => Number(second.favorite) - Number(first.favorite) || second.savedAt - first.savedAt)
    .slice(0, maximumSavedMixes);
}
