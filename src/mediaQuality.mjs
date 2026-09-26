export const mediaQualityOptions = ["auto", "full", "balanced"];

export function normalizeMediaQuality(value) {
  return mediaQualityOptions.includes(value) ? value : "auto";
}

export function connectionSnapshot(connection = {}) {
  return {
    saveData: Boolean(connection?.saveData),
    effectiveType: String(connection?.effectiveType || "").toLowerCase(),
    downlink: Number.isFinite(Number(connection?.downlink)) ? Number(connection.downlink) : undefined,
  };
}

export function effectiveMediaQuality(preference = "auto", connection = {}, dataSaverMode = false) {
  if (dataSaverMode) return "audio-only";
  const normalized = normalizeMediaQuality(preference);
  if (normalized !== "auto") return normalized;
  const snapshot = connectionSnapshot(connection);
  const constrained = snapshot.saveData
    || /(^|-)2g$/.test(snapshot.effectiveType)
    || snapshot.effectiveType === "3g"
    || (snapshot.downlink !== undefined && snapshot.downlink > 0 && snapshot.downlink < 2);
  return constrained ? "balanced" : "full";
}

export function efficientAudioRequested(preference = "auto", connection = {}, dataSaverMode = false) {
  if (dataSaverMode) return true;
  return effectiveMediaQuality(preference, connection, false) === "balanced";
}
