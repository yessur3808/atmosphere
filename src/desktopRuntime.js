import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "./siteUrl.mjs";

export async function initializeDesktopRuntime({ togglePlayback } = {}) {
  if (!isTauriRuntime()) return () => {};

  try {
    document.documentElement.dataset.runtime = "tauri";
    const unlistenToggle = await listen("atmosphere://toggle-playback", () => {
      togglePlayback?.();
    });

    return () => {
      unlistenToggle();
      delete document.documentElement.dataset.runtime;
    };
  } catch (error) {
    console.warn("Atmosphere desktop bridge is unavailable", error);
    return () => {};
  }
}
