const MINI_PLAYER_STYLES = `
  :root {
    --accent: #83b7d2;
    --accent-rgb: 131, 183, 210;
    color-scheme: dark;
    font-family: "Helvetica Neue", "Segoe UI Variable", "SF Pro Display", Arial, sans-serif;
  }

  * { box-sizing: border-box; }
  html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #090b0d; }
  button { font: inherit; }

  .mini-player {
    position: relative;
    width: 100%;
    height: 100%;
    min-width: 270px;
    min-height: 180px;
    overflow: hidden;
    color: #f8f8f4;
    background: #111416;
  }

  .mini-player video,
  .mini-poster,
  .mini-wash { position: absolute; inset: 0; width: 100%; height: 100%; }

  .mini-player video {
    object-fit: cover;
    object-position: var(--video-position, 50% 50%);
    transform: scale(var(--video-scale, 1.06));
    filter: saturate(.82) contrast(1.08) brightness(.68);
  }

  .mini-poster {
    background-position: var(--video-position, 50% 50%);
    background-size: cover;
    filter: saturate(.78) brightness(.64);
  }

  .mini-wash {
    background:
      radial-gradient(circle at 76% 18%, rgba(var(--accent-rgb), .16), transparent 42%),
      linear-gradient(180deg, rgba(5, 7, 8, .18), rgba(5, 7, 8, .76));
  }

  .mini-glass {
    position: absolute;
    inset: 10px;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 8px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, .18);
    border-radius: 22px;
    background: linear-gradient(145deg, rgba(24, 27, 29, .76), rgba(10, 13, 15, .66));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .12), 0 16px 44px rgba(0, 0, 0, .28);
    backdrop-filter: blur(22px) saturate(145%);
    -webkit-backdrop-filter: blur(22px) saturate(145%);
  }

  .mini-head,
  .mini-controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

  .mini-head {
    min-height: 38px;
    padding: 4px 4px 4px 12px;
    border: 1px solid rgba(255, 255, 255, .13);
    border-radius: 999px;
    background: linear-gradient(145deg, rgba(42, 46, 49, .7), rgba(12, 15, 17, .58));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .11), 0 8px 24px rgba(0, 0, 0, .16);
    backdrop-filter: blur(14px) saturate(140%);
    -webkit-backdrop-filter: blur(14px) saturate(140%);
  }

  .mini-brand {
    font-size: 10px;
    font-weight: 710;
    letter-spacing: .18em;
    text-shadow: 0 1px 0 rgba(255, 255, 255, .16), 0 3px 8px rgba(0, 0, 0, .38);
  }
  .mini-brand i { color: var(--accent); font-style: normal; }

  .mini-close,
  .mini-control {
    display: grid;
    place-items: center;
    border: 1px solid rgba(255, 255, 255, .14);
    border-radius: 999px;
    color: rgba(255, 255, 255, .82);
    background: rgba(18, 21, 23, .76);
    cursor: pointer;
    transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;
  }

  .mini-close {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    padding: 0;
    color: rgba(255, 255, 255, .9);
    background: linear-gradient(145deg, rgba(255, 255, 255, .14), rgba(12, 15, 17, .78));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .14), 0 6px 16px rgba(0, 0, 0, .18);
  }
  .mini-close svg {
    display: block;
    width: 13px;
    height: 13px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
  }
  .mini-control { width: 36px; height: 36px; font-size: 15px; }
  .mini-control.play { width: 48px; height: 48px; color: #111315; background: rgba(250, 250, 247, .96); }
  .mini-close:hover,
  .mini-control:hover { transform: scale(1.05); border-color: rgba(var(--accent-rgb), .58); }
  .mini-close:hover { color: var(--accent); background: rgba(var(--accent-rgb), .16); }
  .mini-close:active,
  .mini-control:active { transform: scale(.94); }
  .mini-close:focus-visible,
  .mini-control:focus-visible { outline: 2px solid rgba(var(--accent-rgb), .72); outline-offset: 2px; }

  .mini-copy { align-self: end; min-width: 0; }
  .mini-scene { margin: 0 0 4px; color: rgba(var(--accent-rgb), .92); font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
  .mini-track { margin: 0; overflow: hidden; font-size: clamp(21px, 7vw, 30px); font-weight: 470; letter-spacing: -.045em; text-overflow: ellipsis; white-space: nowrap; }
  .mini-note { margin: 4px 0 0; overflow: hidden; color: rgba(255, 255, 255, .55); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }

  .mini-visualizer { height: 28px; display: flex; align-items: center; gap: 3px; }
  .mini-visualizer i { width: 3px; min-height: 4px; border-radius: 999px; background: linear-gradient(to top, rgba(255, 255, 255, .52), var(--accent)); transition: height 80ms linear; }
  .mini-volume-control {
    min-width: 112px;
    flex: 1;
    display: grid;
    grid-template-columns: 14px minmax(48px, 1fr) 31px;
    align-items: center;
    gap: 5px;
    padding: 6px 8px;
    border: 1px solid rgba(255, 255, 255, .12);
    border-radius: 999px;
    background: rgba(10, 13, 15, .5);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .08);
  }
  .mini-volume-control svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
    color: rgba(255, 255, 255, .58);
  }
  .mini-volume-slider {
    --volume-progress: 52%;
    width: 100%;
    height: 16px;
    margin: 0;
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    cursor: pointer;
  }
  .mini-volume-slider::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent) 0 var(--volume-progress), rgba(255, 255, 255, .16) var(--volume-progress) 100%);
  }
  .mini-volume-slider::-moz-range-track { height: 4px; border: 0; border-radius: 999px; background: rgba(255, 255, 255, .16); }
  .mini-volume-slider::-moz-range-progress { height: 4px; border-radius: 999px; background: var(--accent); }
  .mini-volume-slider::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    margin-top: -5px;
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid rgba(255, 255, 255, .72);
    border-radius: 50%;
    background: #f7f7f3;
    box-shadow: 0 2px 7px rgba(0, 0, 0, .38), 0 0 0 3px rgba(var(--accent-rgb), .12);
  }
  .mini-volume-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border: 1px solid rgba(255, 255, 255, .72);
    border-radius: 50%;
    background: #f7f7f3;
    box-shadow: 0 2px 7px rgba(0, 0, 0, .38), 0 0 0 3px rgba(var(--accent-rgb), .12);
  }
  .mini-volume-slider:focus-visible { outline: 2px solid rgba(var(--accent-rgb), .72); outline-offset: 3px; border-radius: 999px; }
  .mini-volume { min-width: 31px; color: rgba(255, 255, 255, .64); font-size: 10px; font-variant-numeric: tabular-nums; text-align: right; }
`;

export function createMiniPlayer({ getState, setPlaybackPlaying, setVolume, previousTrack, nextTrack, onStateChange }) {
  let floatingWindow;
  let floatingDocument;
  let inlineFrame;
  let miniVideo;
  let attachedVideo;
  let mode = "";
  let automatic = false;
  let opening = false;
  let syncTimer;
  let metadataKey = "";

  const handleNativeEnter = () => setOpenState(true, "native", automatic);
  const handleNativeLeave = () => setOpenState(false, "", false);
  const handleWebkitMode = () => {
    const open = attachedVideo?.webkitPresentationMode === "picture-in-picture";
    setOpenState(open, open ? "native" : "", open ? automatic : false);
  };
  const handleNativePause = () => {
    if (mode === "native") setPlaybackPlaying(false);
  };
  const handleNativePlay = () => {
    if (mode === "native") setPlaybackPlaying(true);
  };

  function setOpenState(open, nextMode = "", wasAutomatic = false) {
    mode = open ? nextMode : "";
    automatic = open && wasAutomatic;
    onStateChange?.(open, mode);
  }

  function attachVideoListeners() {
    const video = getState().video;
    if (video === attachedVideo) return;
    if (attachedVideo) {
      attachedVideo.removeEventListener("enterpictureinpicture", handleNativeEnter);
      attachedVideo.removeEventListener("leavepictureinpicture", handleNativeLeave);
      attachedVideo.removeEventListener("webkitpresentationmodechanged", handleWebkitMode);
      attachedVideo.removeEventListener("pause", handleNativePause);
      attachedVideo.removeEventListener("play", handleNativePlay);
    }
    attachedVideo = video;
    if (!attachedVideo) return;
    attachedVideo.addEventListener("enterpictureinpicture", handleNativeEnter);
    attachedVideo.addEventListener("leavepictureinpicture", handleNativeLeave);
    attachedVideo.addEventListener("webkitpresentationmodechanged", handleWebkitMode);
    attachedVideo.addEventListener("pause", handleNativePause);
    attachedVideo.addEventListener("play", handleNativePlay);
  }

  function updateMediaSession(state) {
    if (!("mediaSession" in navigator) || !("MediaMetadata" in window)) return;
    const nextKey = `${state.sceneTitle}|${state.trackTitle}|${state.trackNote}`;
    if (metadataKey === nextKey) return;
    metadataKey = nextKey;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.trackTitle,
      artist: `Atmosphere · ${state.sceneTitle}`,
      album: state.trackNote,
    });
  }

  function setMediaAction(action, handler) {
    try { navigator.mediaSession?.setActionHandler(action, handler); } catch (error) { /* Unsupported action. */ }
  }

  function buildThemedWindow(targetWindow, targetMode) {
    floatingWindow = targetWindow;
    floatingDocument = targetWindow.document;
    floatingDocument.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0a0c0d"><title>Atmosphere Mini Player</title><style>${MINI_PLAYER_STYLES}</style>`;
    floatingDocument.body.innerHTML = `
      <main class="mini-player">
        <div class="mini-poster"></div>
        <video autoplay muted loop playsinline></video>
        <div class="mini-wash"></div>
        <section class="mini-glass" aria-label="Atmosphere mini player">
          <header class="mini-head">
            <span class="mini-brand">ATMO <i>—</i> SPHERE</span>
            <button class="mini-close" type="button" aria-label="Close mini player">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5 16.5 16.5M16.5 7.5 7.5 16.5" /></svg>
            </button>
          </header>
          <div class="mini-copy">
            <p class="mini-scene"></p>
            <h1 class="mini-track"></h1>
            <p class="mini-note"></p>
          </div>
          <footer class="mini-controls">
            <button class="mini-control previous" type="button" aria-label="Previous audio track">‹</button>
            <button class="mini-control play" type="button" aria-label="Play audio and video">▶</button>
            <button class="mini-control next" type="button" aria-label="Next audio track">›</button>
            <div class="mini-visualizer" aria-hidden="true">${Array.from({ length: 8 }, () => "<i></i>").join("")}</div>
            <label class="mini-volume-control" aria-label="Audio volume">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 10v4h3l4 3V7L8 10H5Z" /><path d="M15 9.5c1.2 1.4 1.2 3.6 0 5" /></svg>
              <input class="mini-volume-slider" type="range" min="0" max="100" step="1" value="52" aria-label="Audio volume" />
              <span class="mini-volume">52%</span>
            </label>
          </footer>
        </section>
      </main>`;

    miniVideo = floatingDocument.querySelector("video");
    floatingDocument.querySelector(".mini-close").addEventListener("click", close);
    floatingDocument.querySelector(".play").addEventListener("click", () => {
      const state = getState();
      const isPlaying = state.isAudioPlaying && (state.dataSaverMode || state.isVideoPlaying);
      setPlaybackPlaying(!isPlaying);
    });
    floatingDocument.querySelector(".previous").addEventListener("click", previousTrack);
    floatingDocument.querySelector(".next").addEventListener("click", nextTrack);
    floatingDocument.querySelector(".mini-volume-slider").addEventListener("input", (event) => {
      setVolume(Number(event.currentTarget.value) / 100);
    });
    targetWindow.addEventListener("pagehide", handleFloatingWindowClosed, { once: true });
    targetWindow.addEventListener("beforeunload", handleFloatingWindowClosed, { once: true });
    setOpenState(true, targetMode, automatic);
    clearInterval(syncTimer);
    syncTimer = setInterval(sync, 250);
    sync();
  }

  function handleFloatingWindowClosed() {
    clearInterval(syncTimer);
    floatingWindow = undefined;
    floatingDocument = undefined;
    inlineFrame = undefined;
    miniVideo = undefined;
    if (mode === "document" || mode === "popup" || mode === "inline") setOpenState(false, "", false);
  }

  function syncVideo(state) {
    if (!miniVideo) return;
    if (!state.video || state.dataSaverMode) {
      miniVideo.pause();
      miniVideo.removeAttribute("src");
      miniVideo.load();
      return;
    }
    const source = state.video.currentSrc || state.video.src;
    if (source && miniVideo.src !== source) {
      miniVideo.src = source;
      miniVideo.poster = state.poster;
      miniVideo.addEventListener("loadedmetadata", () => {
        miniVideo.currentTime = state.video.currentTime || 0;
      }, { once: true });
    } else if (miniVideo.readyState >= 1 && Math.abs(miniVideo.currentTime - state.video.currentTime) > 1.8) {
      miniVideo.currentTime = state.video.currentTime || 0;
    }
    miniVideo.playbackRate = state.video.playbackRate || 1;
    if (state.isVideoPlaying) miniVideo.play().catch(() => {});
    else miniVideo.pause();
  }

  function sync(providedState) {
    const state = providedState || getState();
    attachVideoListeners();
    updateMediaSession(state);
    if (attachedVideo && "autoPictureInPicture" in attachedVideo) {
      attachedVideo.autoPictureInPicture = Boolean(state.isAudioPlaying && state.pipPreference === "automatic");
    }
    if (!floatingDocument || (mode !== "inline" && floatingWindow?.closed)) {
      if (mode !== "inline" && floatingWindow?.closed) handleFloatingWindowClosed();
      return;
    }

    const root = floatingDocument.documentElement;
    root.style.setProperty("--accent", state.accent);
    root.style.setProperty("--accent-rgb", state.accentRgb);
    root.style.setProperty("--video-position", state.videoPosition);
    root.style.setProperty("--video-scale", state.videoScale);
    floatingDocument.querySelector(".mini-poster").style.backgroundImage = `url('${state.poster}')`;
    floatingDocument.querySelector(".mini-scene").textContent = `${state.category} · ${state.sceneTitle}`;
    floatingDocument.querySelector(".mini-track").textContent = state.trackTitle;
    floatingDocument.querySelector(".mini-note").textContent = state.trackNote;
    const volumePercent = Math.round(state.volume * 100);
    const volumeSlider = floatingDocument.querySelector(".mini-volume-slider");
    volumeSlider.value = volumePercent;
    volumeSlider.style.setProperty("--volume-progress", `${volumePercent}%`);
    floatingDocument.querySelector(".mini-volume").textContent = `${volumePercent}%`;

    const playButton = floatingDocument.querySelector(".play");
    const isPlaybackPlaying = state.isAudioPlaying && (state.dataSaverMode || state.isVideoPlaying);
    playButton.textContent = isPlaybackPlaying ? "Ⅱ" : "▶";
    const mediaLabel = state.dataSaverMode ? "audio" : "audio and video";
    playButton.setAttribute("aria-label", `${isPlaybackPlaying ? "Pause" : "Play"} ${mediaLabel}`);

    floatingDocument.querySelectorAll(".mini-visualizer i").forEach((bar, index) => {
      bar.style.height = `${Math.max(4, Math.min(28, state.visualLevels[index] || 4))}px`;
      bar.style.opacity = state.isAudioPlaying ? ".9" : ".4";
    });
    syncVideo(state);
  }

  async function openDocumentPip() {
    const targetWindow = await window.documentPictureInPicture.requestWindow({ width: 380, height: 240 });
    buildThemedWindow(targetWindow, "document");
  }

  async function openNativePip(video) {
    if (!video) return false;
    if (document.pictureInPictureElement === video || video.webkitPresentationMode === "picture-in-picture") {
      setOpenState(true, "native", automatic);
      return true;
    }
    if (typeof video.requestPictureInPicture === "function" && document.pictureInPictureEnabled !== false) {
      await video.requestPictureInPicture();
      setOpenState(true, "native", automatic);
      return true;
    }
    if (typeof video.webkitSupportsPresentationMode === "function" && video.webkitSupportsPresentationMode("picture-in-picture")) {
      video.webkitSetPresentationMode("picture-in-picture");
      setOpenState(true, "native", automatic);
      return true;
    }
    return false;
  }

  function openInlinePlayer() {
    if (inlineFrame?.isConnected) return true;
    inlineFrame = document.createElement("iframe");
    inlineFrame.title = "Atmosphere mini player";
    inlineFrame.setAttribute("allow", "autoplay; picture-in-picture");
    inlineFrame.style.cssText = [
      "position:fixed",
      "z-index:60",
      "right:18px",
      "bottom:18px",
      "width:min(380px,calc(100vw - 24px))",
      "height:240px",
      "border:0",
      "border-radius:24px",
      "overflow:hidden",
      "background:#090b0d",
      "box-shadow:0 24px 80px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.12)",
    ].join(";");
    document.body.appendChild(inlineFrame);
    buildThemedWindow(inlineFrame.contentWindow, "inline");
    inlineFrame.animate(
      [{ opacity: 0, transform: "translateY(18px) scale(.96)" }, { opacity: 1, transform: "none" }],
      { duration: 360, easing: "cubic-bezier(.16,1,.3,1)" }
    );
    return true;
  }

  async function open({ automatic: automaticRequest = false } = {}) {
    if (opening || isOpen()) return true;
    opening = true;
    automatic = automaticRequest;
    const video = getState().video;
    try {
      if ("documentPictureInPicture" in window && window.isSecureContext) {
        try {
          await openDocumentPip();
          return true;
        } catch (error) { /* Try the remaining supported PiP modes. */ }
      }

      // Never use window.open as a fallback: mobile and embedded browsers
      // commonly turn it into a full tab. Keep the themed controls in a
      // fixed bottom-right corner instead.
      if (!automaticRequest && openInlinePlayer()) return true;

      // Native PiP remains a last-resort fallback for automatic transitions
      // where browsers refuse a new popup without a user gesture.
      try {
        if (await openNativePip(video)) return true;
      } catch (error) { /* PiP is unavailable in this browser context. */ }

      return false;
    } finally {
      opening = false;
    }
  }

  async function close() {
    clearInterval(syncTimer);
    if (mode === "inline") {
      inlineFrame?.remove();
      handleFloatingWindowClosed();
      return;
    }
    if (mode === "document" || mode === "popup") {
      floatingWindow?.close();
      handleFloatingWindowClosed();
      return;
    }
    if (document.pictureInPictureElement) {
      try { await document.exitPictureInPicture(); } catch (error) { /* Already closed. */ }
    } else if (attachedVideo?.webkitPresentationMode === "picture-in-picture") {
      attachedVideo.webkitSetPresentationMode("inline");
    }
    setOpenState(false, "", false);
  }

  function isOpen() {
    return Boolean(
      (mode === "inline" && inlineFrame?.isConnected) ||
      (floatingWindow && !floatingWindow.closed) ||
      document.pictureInPictureElement ||
      attachedVideo?.webkitPresentationMode === "picture-in-picture"
    );
  }

  async function toggle() {
    if (isOpen()) {
      await close();
      return false;
    }
    return open({ automatic: false });
  }

  async function handleEnterPictureInPicture() {
    const state = getState();
    if (state.pipPreference === "off" || !state.isAudioPlaying || isOpen()) return;
    await open({ automatic: state.pipPreference === "automatic" });
  }

  function destroy() {
    close();
    if (attachedVideo) {
      attachedVideo.removeEventListener("enterpictureinpicture", handleNativeEnter);
      attachedVideo.removeEventListener("leavepictureinpicture", handleNativeLeave);
      attachedVideo.removeEventListener("webkitpresentationmodechanged", handleWebkitMode);
      attachedVideo.removeEventListener("pause", handleNativePause);
      attachedVideo.removeEventListener("play", handleNativePlay);
    }
    ["play", "pause", "previoustrack", "nexttrack", "enterpictureinpicture"].forEach((action) => setMediaAction(action, null));
  }

  setMediaAction("play", () => setPlaybackPlaying(true));
  setMediaAction("pause", () => setPlaybackPlaying(false));
  setMediaAction("previoustrack", previousTrack);
  setMediaAction("nexttrack", nextTrack);
  setMediaAction("enterpictureinpicture", handleEnterPictureInPicture);
  sync();

  return { open, close, toggle, sync, destroy, isOpen, getMode: () => mode };
}
