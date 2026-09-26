<script>
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
  import { mediaUrl } from "../siteUrl.mjs";

  export let background = "";
  export let adaptiveBackground = "";
  export let poster = "";
  export let paused = false;
  export let playbackRate = 1;
  export let start = 0;
  export let scale = 1.025;
  export let position = "50% 50%";
  export let viewKey = "";
  export let disabled = false;
  export let immersive = false;

  const dispatch = createEventDispatcher();
  const slots = [0, 1];
  let videoElements = [];
  let slotSources = ["", ""];
  let slotVisible = [false, false];
  let activeSlot = 0;
  let pendingSlot = 0;
  let activeSource = "";
  let desiredSource = "";
  let activeView = "";
  let useAdaptive = false;
  let forceAdaptive = false;
  let mediaReady = false;
  let loading = true;
  let failed = false;
  let connection;
  let transitionTimer;

  export function getVideoElement() {
    return disabled ? undefined : videoElements[activeSlot];
  }

  export function setAutoPictureInPicture(enabled) {
    const videoElement = getVideoElement();
    if (videoElement && "autoPictureInPicture" in videoElement) {
      videoElement.autoPictureInPicture = Boolean(enabled && !disabled);
    }
  }

  function updateMediaPreference() {
    const constrainedNetwork = connection?.saveData || /(2g|3g)$/.test(connection?.effectiveType || "");
    // Modern phones and tablets have high-density displays, so viewport width
    // is not a useful quality signal. Prefer the 1080p source unless the user
    // or browser has explicitly indicated a constrained connection.
    useAdaptive = forceAdaptive || constrainedNetwork;
  }

  function resolveVideoSource(source) {
    if (/^https?:\/\//i.test(source || "")) return source;
    return source ? mediaUrl(`assets/videos/${source}`) : "";
  }

  onMount(() => {
    connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    updateMediaPreference();
    mediaReady = true;
    connection?.addEventListener?.("change", updateMediaPreference);
  });

  $: selectedBackground = mediaReady && !disabled ? (useAdaptive && adaptiveBackground ? adaptiveBackground : background) : "";
  $: nextSource = resolveVideoSource(selectedBackground);
  $: posterSource = poster ? mediaUrl(`assets/videos/${poster}`) : "";
  $: requestSource(nextSource);
  $: syncPlayback(paused, disabled, playbackRate, activeSlot);
  $: if (!disabled && viewKey && activeView !== viewKey && videoElements[activeSlot]?.readyState >= 1) {
    applyView(videoElements[activeSlot]);
  }

  async function requestSource(source) {
    if (!mediaReady) return;
    if (!source) {
      if (!desiredSource && !slotSources.some(Boolean)) return;
      desiredSource = "";
      activeSource = "";
      activeView = "";
      loading = false;
      failed = false;
      slotVisible = [false, false];
      slotSources = ["", ""];
      videoElements.filter(Boolean).forEach((element) => element.pause());
      await tick();
      videoElements.filter(Boolean).forEach((element) => {
        element.removeAttribute("src");
        element.load();
      });
      return;
    }
    if (source === desiredSource && (source === activeSource || slotSources[pendingSlot] === source)) return;

    desiredSource = source;
    loading = true;
    failed = false;
    activeView = "";
    pendingSlot = activeSource ? 1 - activeSlot : activeSlot;
    const nextSources = [...slotSources];
    nextSources[pendingSlot] = source;
    slotSources = nextSources;
    const nextVisibility = [...slotVisible];
    nextVisibility[pendingSlot] = false;
    slotVisible = nextVisibility;
    await tick();
    const incomingVideo = videoElements[pendingSlot];
    if (!incomingVideo || slotSources[pendingSlot] !== desiredSource) return;
    incomingVideo.playbackRate = playbackRate;
    incomingVideo.load();
  }

  function syncPlayback(shouldPause, audioOnly, rate) {
    videoElements.filter(Boolean).forEach((element, slot) => {
      element.playbackRate = rate;
      if (audioOnly || shouldPause || slot !== activeSlot) element.pause();
      else if (slotVisible[slot]) element.play().catch(() => {});
    });
  }

  function handleLoadedMetadata(slot) {
    const videoElement = videoElements[slot];
    if (!videoElement) return;
    videoElement.playbackRate = playbackRate;
    applyView(videoElement);
    if (slotSources[slot] === desiredSource) dispatch("durationchange", videoElement.duration || 0);
  }

  function revealVideo(slot) {
    const incomingVideo = videoElements[slot];
    if (!incomingVideo || disabled || slotSources[slot] !== desiredSource) return;
    const outgoingSlot = activeSlot;
    const outgoingVideo = videoElements[outgoingSlot];
    const nextVisibility = [...slotVisible];
    nextVisibility[slot] = true;
    if (slot !== outgoingSlot) nextVisibility[outgoingSlot] = false;
    slotVisible = nextVisibility;
    activeSlot = slot;
    activeSource = desiredSource;
    loading = false;
    failed = false;
    if (!paused) incomingVideo.play().catch(() => {});
    window.clearTimeout(transitionTimer);
    if (slot !== outgoingSlot) {
      transitionTimer = window.setTimeout(() => outgoingVideo?.pause(), 900);
    }
  }

  function applyView(videoElement) {
    if (!videoElement) return;
    activeView = viewKey;
    if (Number.isFinite(videoElement.duration)) {
      videoElement.currentTime = Math.min(videoElement.duration * start, Math.max(0, videoElement.duration - 0.15));
    }
    videoElement.playbackRate = playbackRate;
  }

  function handleError(slot) {
    if (slotSources[slot] !== desiredSource) return;
    if (!useAdaptive && adaptiveBackground) {
      forceAdaptive = true;
      updateMediaPreference();
      return;
    }
    loading = false;
    failed = true;
  }

  function handleTimeUpdate(slot) {
    if (slot === activeSlot) dispatch("timechange", videoElements[slot]?.currentTime || 0);
  }

  onDestroy(() => {
    window.clearTimeout(transitionTimer);
    videoElements.filter(Boolean).forEach((element) => element.pause());
    connection?.removeEventListener?.("change", updateMediaPreference);
  });
</script>

<div
  class:loading
  class:failed
  class:audio-only={disabled}
  class:immersive
  class="backdrop"
  aria-hidden="true"
  style={`--video-scale: ${scale}; --video-position: ${position}; --poster: url('${posterSource}')`}
>
  <div class="poster"></div>
  {#each slots as slot}
    <video
      bind:this={videoElements[slot]}
      class:visible={slotVisible[slot]}
      src={slotSources[slot] || undefined}
      muted
      loop
      playsinline
      preload={slotSources[slot] ? "metadata" : "none"}
      poster={posterSource || undefined}
      on:loadedmetadata={() => handleLoadedMetadata(slot)}
      on:canplay={() => revealVideo(slot)}
      on:loadstart={() => { if (slotSources[slot] === desiredSource) loading = true; }}
      on:waiting={() => { if (slot === activeSlot) loading = true; }}
      on:playing={() => { if (slot === activeSlot) { loading = false; failed = false; } }}
      on:error={() => handleError(slot)}
      on:timeupdate={() => handleTimeUpdate(slot)}
    ></video>
  {/each}
  <div class="wash"></div>
  <div class="grain"></div>
</div>

<style>
  .backdrop,
  .poster,
  .backdrop video,
  .wash,
  .grain {
    position: absolute;
    inset: 0;
  }

  .backdrop {
    position: fixed;
    z-index: 0;
    overflow: hidden;
    background: #101213;
  }

  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: var(--video-position);
    transform: scale(var(--video-scale));
    filter: saturate(0.78) contrast(1.08) brightness(0.75);
    opacity: 0;
    transition: opacity 820ms cubic-bezier(0.22, 1, 0.36, 1), transform 1.1s cubic-bezier(0.2, 0.75, 0.2, 1), object-position 1.1s cubic-bezier(0.2, 0.75, 0.2, 1);
  }

  video.visible { opacity: 1; }

  .poster {
    background-color: #101213;
    background-image: var(--poster);
    background-position: var(--video-position);
    background-size: cover;
    transform: scale(var(--video-scale));
    filter: saturate(0.74) contrast(1.08) brightness(0.68);
  }

  .failed video { opacity: 0; }

  .audio-only video { display: none; }

  .audio-only .poster {
    filter: saturate(0.6) contrast(1.05) brightness(0.5) blur(0.2px);
    animation: poster-breathe 18s ease-in-out infinite alternate;
  }

  @keyframes poster-breathe {
    from { transform: scale(var(--video-scale)); }
    to { transform: scale(calc(var(--video-scale) + 0.018)); }
  }

  .failed .poster {
    filter: saturate(0.56) contrast(1.04) brightness(0.54);
  }

  .wash {
    background:
      radial-gradient(circle at 68% 42%, transparent 0 22%, rgba(4, 7, 8, 0.17) 52%, rgba(2, 4, 5, 0.58) 100%),
      linear-gradient(90deg, rgba(2, 5, 6, 0.54) 0%, rgba(3, 5, 6, 0.12) 54%, rgba(2, 4, 5, 0.32) 100%),
      linear-gradient(180deg, rgba(3, 5, 6, 0.16) 0%, transparent 50%, rgba(2, 4, 5, 0.42) 100%);
  }

  .grain {
    opacity: 0.1;
    pointer-events: none;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
    mix-blend-mode: soft-light;
  }

  .backdrop.immersive video,
  .backdrop.immersive .poster,
  .backdrop.immersive.failed .poster,
  .backdrop.immersive.audio-only .poster {
    filter: none;
  }

  .backdrop.immersive .wash,
  .backdrop.immersive .grain {
    opacity: 0;
    visibility: hidden;
  }

  @media (max-width: 600px) {
    .wash {
      background:
        linear-gradient(180deg, rgba(2, 4, 5, 0.12) 0%, rgba(2, 4, 5, 0.1) 34%, rgba(2, 4, 5, 0.78) 100%),
        radial-gradient(circle at 50% 35%, transparent 0 20%, rgba(2, 4, 5, 0.38) 90%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    video { transform: none; }
  }
</style>
