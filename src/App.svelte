<script>
  import { onDestroy, onMount } from "svelte";
  import Background from "./components/Background.svelte";
  import AtmosphereIcon from "./components/AtmosphereIcon.svelte";
  import { createMiniPlayer } from "./miniPlayer";
  import { scenes } from "./sceneLibrary";
  import { siteUrl } from "./siteUrl.mjs";

  let audioElement;
  let backgroundComponent;
  let activeIndex = 0;
  let selectedAudio = 0;
  let selectedVideo = 0;
  let audioStarted = false;
  let audioDirty = true;
  let isAudioPlaying = false;
  let isVideoPlaying = true;
  let volume = 0.52;
  let audioLoading = false;
  let audioError = "";
  let audioContext;
  let mediaSource;
  let gainNode;
  let analyserNode;
  let analyserData;
  let analyserFrame;
  let graphUnavailable = false;
  let visualLevels = [4, 6, 5, 7, 4, 6, 5, 4];
  let miniPlayerController;
  let miniPlayerOpen = false;
  let miniPlayerMode = "";
  let miniPlayerStatus = "";
  let pipPreference = "ask";
  let pipMenuOpen = false;
  let pipPromptVisible = false;

  const pipPreferences = [
    { id: "automatic", title: "Automatic", detail: "Use floating PiP when your browser supports it" },
    { id: "manual", title: "Manual only", detail: "Open only when you press the button" },
    { id: "off", title: "Off", detail: "Never open the mini player" },
  ];
  const homeHref = siteUrl("");
  const faviconHref = siteUrl("favicon-v2.png");
  const creditsHref = siteUrl("audio-credits.html");
  const videoCreditsHref = siteUrl("video-credits.html");

  $: activeScene = scenes[activeIndex];
  $: activeTrack = activeScene.audioTracks[selectedAudio];
  $: activeVideo = activeScene.videoLoops[selectedVideo];
  $: miniPlayerSnapshot = {
    sceneTitle: activeScene.title,
    category: activeScene.category,
    accent: activeScene.accent,
    accentRgb: activeScene.accentRgb,
    trackTitle: activeTrack.title,
    trackNote: activeTrack.note,
    isAudioPlaying,
    isVideoPlaying,
    volume,
    visualLevels,
    videoPosition: activeVideo.position,
    videoScale: activeVideo.scale,
    poster: siteUrl(`assets/videos/${activeVideo.poster}`),
    video: backgroundComponent?.getVideoElement(),
    pipPreference,
  };
  $: if (miniPlayerController && miniPlayerSnapshot) {
    backgroundComponent?.setAutoPictureInPicture(isAudioPlaying && pipPreference === "automatic");
    miniPlayerController.sync(miniPlayerSnapshot);
  }

  function ensureAudioGraph() {
    if (gainNode || graphUnavailable || !audioElement) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      graphUnavailable = true;
      return;
    }

    try {
      audioContext = new AudioContext();
      mediaSource = audioContext.createMediaElementSource(audioElement);
      gainNode = audioContext.createGain();
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.82;
      analyserData = new Uint8Array(analyserNode.frequencyBinCount);
      mediaSource.connect(gainNode);
      gainNode.connect(analyserNode);
      analyserNode.connect(audioContext.destination);
      gainNode.gain.value = volume;
      audioElement.volume = 1;
    } catch (error) {
      graphUnavailable = true;
      gainNode = undefined;
      analyserNode = undefined;
    }
  }

  async function resumeAudioGraph() {
    ensureAudioGraph();
    if (audioContext?.state === "suspended") {
      try { await audioContext.resume(); } catch (error) { /* Native media volume remains available. */ }
    }
  }

  function applyVolume() {
    if (!audioElement) return;
    if (gainNode && audioContext) {
      audioElement.volume = 1;
      gainNode.gain.cancelScheduledValues(audioContext.currentTime);
      gainNode.gain.setTargetAtTime(volume, audioContext.currentTime, 0.015);
    } else {
      audioElement.volume = volume;
    }
  }

  function drawVisualizer() {
    if (!analyserNode || !isAudioPlaying) return;
    analyserNode.getByteFrequencyData(analyserData);
    const bands = [1, 2, 4, 7, 11, 17, 25, 38];
    visualLevels = bands.map((start, index) => {
      const end = Math.min(bands[index + 1] || analyserData.length, analyserData.length);
      let total = 0;
      for (let bin = start; bin < end; bin += 1) total += analyserData[bin];
      const strength = total / Math.max(1, end - start) / 255;
      return Math.round(4 + Math.pow(strength, 0.62) * 28);
    });
    analyserFrame = requestAnimationFrame(drawVisualizer);
  }

  function startVisualizer() {
    cancelAnimationFrame(analyserFrame);
    if (analyserNode) analyserFrame = requestAnimationFrame(drawVisualizer);
  }

  function stopVisualizer() {
    cancelAnimationFrame(analyserFrame);
    visualLevels = [4, 5, 4, 6, 4, 5, 4, 4];
  }

  async function playTrack(track) {
    audioLoading = true;
    audioError = "";
    if (audioDirty || !audioElement.currentSrc.endsWith(track.src)) {
      audioElement.src = track.src;
      audioElement.load();
    }
    await resumeAudioGraph();
    applyVolume();
    try {
      await audioElement.play();
      audioStarted = true;
      audioDirty = false;
      if (pipPreference === "ask") pipPromptVisible = true;
    } catch (error) {
      isAudioPlaying = false;
      audioLoading = false;
      audioError = "Audio could not start";
    }
  }

  async function toggleAudio() {
    if (isAudioPlaying) {
      audioElement.pause();
      return;
    }
    await playTrack(activeTrack);
  }

  async function setAudioPlaying(shouldPlay) {
    if (shouldPlay && !isAudioPlaying) await playTrack(activeTrack);
    else if (!shouldPlay && isAudioPlaying) audioElement.pause();
  }

  async function setMiniPlayerPlayback(shouldPlay) {
    const video = backgroundComponent?.getVideoElement();
    isVideoPlaying = shouldPlay;

    if (!shouldPlay) {
      audioElement?.pause();
      video?.pause();
      return;
    }

    const videoPlayback = video?.play?.().catch(() => {});
    await Promise.allSettled([setAudioPlaying(true), videoPlayback]);
  }

  async function previousAudioTrack() {
    const nextIndex = (selectedAudio - 1 + activeScene.audioTracks.length) % activeScene.audioTracks.length;
    await selectTrack(nextIndex);
  }

  async function nextAudioTrack() {
    const nextIndex = (selectedAudio + 1) % activeScene.audioTracks.length;
    await selectTrack(nextIndex);
  }

  async function selectScene(index) {
    const continuePlaying = isAudioPlaying;
    activeIndex = index;
    selectedAudio = 0;
    selectedVideo = 0;
    isVideoPlaying = true;
    audioDirty = true;
    audioError = "";
    if (continuePlaying) {
      await playTrack(scenes[index].audioTracks[0]);
    } else if (audioStarted) {
      audioElement.pause();
    }
  }

  async function selectTrack(index) {
    const continuePlaying = isAudioPlaying;
    selectedAudio = index;
    audioDirty = true;
    audioError = "";
    if (continuePlaying) {
      await playTrack(activeScene.audioTracks[index]);
    }
  }

  function selectVideo(index) {
    selectedVideo = index;
    isVideoPlaying = true;
  }

  function setMiniPlayerVolume(nextVolume) {
    volume = Math.max(0, Math.min(1, Number(nextVolume)));
    resumeAudioGraph();
    applyVolume();
  }

  function updateVolume(event) {
    setMiniPlayerVolume(event.currentTarget.value);
  }

  function getMiniPlayerState() {
    return {
      ...miniPlayerSnapshot,
      video: backgroundComponent?.getVideoElement(),
    };
  }

  async function toggleMiniPlayer() {
    if (!miniPlayerController) return;
    if (pipPreference === "off") {
      pipMenuOpen = true;
      miniPlayerStatus = "Mini player is off. Choose Automatic or Manual only to enable it.";
      return;
    }
    const wasOpen = miniPlayerController.isOpen();
    miniPlayerStatus = wasOpen ? "Closing mini player" : "Opening mini player";
    const opened = await miniPlayerController.toggle();
    if (!wasOpen && !opened) {
      miniPlayerStatus = "Mini player could not open in this browser.";
    }
  }

  async function choosePipPreference(nextPreference) {
    pipPreference = nextPreference;
    pipPromptVisible = false;
    pipMenuOpen = false;
    localStorage.setItem("atmosphere-pip-preference", nextPreference);
    if (nextPreference === "off") {
      backgroundComponent?.setAutoPictureInPicture(false);
      if (miniPlayerController?.isOpen()) await miniPlayerController.close();
      miniPlayerStatus = "Mini player turned off";
    } else if (nextPreference === "automatic") {
      // PiP and popup creation must happen while this user click still owns
      // browser activation. Waiting until visibilitychange is too late in
      // every major browser, so enabling Automatic opens the player now and
      // keeps it ready when the user leaves the tab.
      miniPlayerStatus = "Opening automatic mini player";
      const opened = await miniPlayerController?.open({ automatic: true, userInitiated: true });
      const openedMode = miniPlayerController?.getMode();
      miniPlayerStatus = !opened
        ? "Automatic mode is on. Press Open mini once to allow the floating player."
        : openedMode === "inline"
          ? "Corner mini player opened. Always-on-top PiP requires a secure browser connection."
          : "Automatic mini player is on and ready when you leave this tab";
    } else {
      miniPlayerStatus = "Mini player set to manual only";
    }
    miniPlayerController?.sync(getMiniPlayerState());
  }

  function dismissPipPrompt() {
    pipPromptVisible = false;
    if (pipPreference === "ask") {
      pipPreference = "manual";
      localStorage.setItem("atmosphere-pip-preference", "manual");
      miniPlayerStatus = "Mini player set to manual only";
    }
  }

  onMount(() => {
    const savedPipPreference = localStorage.getItem("atmosphere-pip-preference");
    if (["automatic", "manual", "off"].includes(savedPipPreference)) {
      pipPreference = savedPipPreference;
      // Reloading destroys the browser activation that allowed the floating
      // window. Automatic therefore needs one fresh, explicit re-arm click
      // each browsing session.
      if (savedPipPreference === "automatic") pipPromptVisible = true;
    }
    miniPlayerController = createMiniPlayer({
      getState: getMiniPlayerState,
      setPlaybackPlaying: setMiniPlayerPlayback,
      setVolume: setMiniPlayerVolume,
      previousTrack: previousAudioTrack,
      nextTrack: nextAudioTrack,
      onStateChange: (open, mode) => {
        miniPlayerOpen = open;
        miniPlayerMode = mode;
        const label = mode === "document" ? "Picture-in-Picture" : mode === "native" ? "Video Picture-in-Picture" : mode === "inline" ? "Corner mini player" : "Mini player window";
        miniPlayerStatus = open ? `${label} opened` : "Mini player closed";
      },
    });
    miniPlayerController.sync(getMiniPlayerState());
  });

  onDestroy(() => {
    cancelAnimationFrame(analyserFrame);
    mediaSource?.disconnect();
    gainNode?.disconnect();
    analyserNode?.disconnect();
    audioContext?.close();
    miniPlayerController?.destroy();
  });
</script>

<div class="app-shell" style={`--accent: ${activeScene.accent}; --accent-rgb: ${activeScene.accentRgb}`}>
  <Background
    bind:this={backgroundComponent}
    background={activeVideo.background}
    adaptiveBackground={activeVideo.adaptiveBackground}
    poster={activeVideo.poster}
    paused={!isVideoPlaying}
    playbackRate={activeVideo.playbackRate}
    start={activeVideo.start}
    scale={activeVideo.scale}
    position={activeVideo.position}
    viewKey={activeVideo.id}
  />
  <audio
    bind:this={audioElement}
    preload="metadata"
    loop
    on:play={() => { isAudioPlaying = true; audioLoading = false; startVisualizer(); }}
    on:pause={() => { isAudioPlaying = false; stopVisualizer(); }}
    on:canplay={() => (audioLoading = false)}
    on:error={() => { audioLoading = false; audioError = "Audio unavailable"; }}
  ></audio>

  <header class="topbar">
    <a class="wordmark" href={homeHref} aria-label="Atmosphere home">
      <img class="brand-icon" src={faviconHref} width="30" height="30" alt="" aria-hidden="true" decoding="async" />
      <span class="wordmark-copy"><span>ATMO</span><i></i><span>SPHERE</span></span>
    </a>
    <div class="topbar-actions">
      <a class="credits-link" href={creditsHref} target="_blank" rel="noreferrer">Audio credits</a>
      <a class="credits-link" href={videoCreditsHref} target="_blank" rel="noreferrer">Video credits</a>
      <div class="pip-control">
        <button
          class:pip-active={miniPlayerOpen}
          class:pip-off={pipPreference === "off"}
          class="pip-toggle glass-button"
          type="button"
          aria-pressed={miniPlayerOpen}
          aria-label={pipPreference === "off" ? "Mini player is off; open options" : miniPlayerOpen ? "Close mini player" : "Open mini player manually"}
          title={pipPreference === "off" ? "Mini player is off" : miniPlayerOpen ? "Close mini player" : "Open the mini player now"}
          on:click={toggleMiniPlayer}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3.5" y="4.5" width="17" height="14" rx="2.5" />
            <rect class="pip-window-mark" x="12" y="11" width="6.5" height="5" rx="1" />
            {#if pipPreference === "off"}<path class="pip-off-mark" d="m5 5 14 14" />{/if}
          </svg>
          <span>{pipPreference === "off" ? "Mini off" : miniPlayerOpen ? "Close mini" : "Open mini"}</span>
        </button>
        <button
          class:active={pipMenuOpen}
          class="pip-options glass-button"
          type="button"
          aria-label="Mini player options"
          aria-expanded={pipMenuOpen}
          on:click={() => (pipMenuOpen = !pipMenuOpen)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </button>

        {#if pipMenuOpen}
          <div class="pip-menu" role="dialog" aria-label="Mini player behavior">
            <div class="pip-menu-heading">
              <strong>Mini player</strong>
              <span>Choose when it can open</span>
            </div>
            {#each pipPreferences as preference}
              <button
                class:active={pipPreference === preference.id}
                type="button"
                aria-pressed={pipPreference === preference.id}
                on:click={() => choosePipPreference(preference.id)}
              >
                <i aria-hidden="true"></i>
                <span><strong>{preference.title}</strong><small>{preference.detail}</small></span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <button
        class="video-toggle glass-button"
        type="button"
        aria-label={isVideoPlaying ? "Pause background video" : "Play background video"}
        on:click={() => (isVideoPlaying = !isVideoPlaying)}
      >
        {#if isVideoPlaying}
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.5v11M15.5 6.5v11" /></svg>
          <span>Pause motion</span>
        {:else}
          <svg class="play-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" /></svg>
          <span>Play motion</span>
        {/if}
      </button>
    </div>
    <p class="sr-only" aria-live="polite">{miniPlayerStatus}</p>
  </header>

  {#if pipPromptVisible}
    <section class="pip-consent" role="dialog" aria-labelledby="pip-consent-title" aria-describedby="pip-consent-copy">
      <button class="pip-consent-close" type="button" aria-label="Use manual mini player" on:click={dismissPipPrompt}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5 16.5 16.5M16.5 7.5 7.5 16.5" /></svg>
      </button>
      <span class="pip-consent-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="14" rx="2.5" /><rect x="12" y="11" width="6.5" height="5" rx="1" /></svg>
      </span>
      <div>
        <p class="kicker">Mini player</p>
        <h2 id="pip-consent-title">{pipPreference === "automatic" ? "Start automatic mini player?" : "Keep Atmosphere visible?"}</h2>
        <p id="pip-consent-copy">Open a corner player now. On secure supported browsers it can remain visible when you leave this tab.</p>
      </div>
      <div class="pip-consent-actions">
        <button class="pip-primary" type="button" on:click={() => choosePipPreference("automatic")}>{pipPreference === "automatic" ? "Start automatic player" : "Turn on automatic"}</button>
        <button type="button" on:click={() => choosePipPreference("manual")}>Manual only</button>
        <button type="button" on:click={() => choosePipPreference("off")}>Turn off</button>
      </div>
    </section>
  {/if}

  <main>
    {#key activeScene.id}
      <section class="scene-hero">
        <div>
          <p class="eyebrow">{activeScene.category} · Scene {String(activeIndex + 1).padStart(2, "0")}</p>
          <h1>{activeScene.title}</h1>
        </div>
        <p>{activeScene.description}</p>
      </section>
    {/key}

    <div class="workspace">
      <section class="library-panel liquid-panel" aria-labelledby="atmosphere-heading">
        <div class="section-heading">
          <div>
            <p class="kicker">Library</p>
            <h2 id="atmosphere-heading">Choose an atmosphere</h2>
          </div>
          <span>{scenes.length} scenes</span>
        </div>

        <div class="scene-grid">
          {#each scenes as scene, index (scene.id)}
            <button
              type="button"
              class="scene-card"
              class:active={index === activeIndex}
              aria-current={index === activeIndex ? "true" : undefined}
              on:click={() => selectScene(index)}
            >
              <AtmosphereIcon scene={scene.id} active={index === activeIndex} />
              <span class="scene-card-copy">
                <strong>{scene.title}</strong>
                <small>{scene.category}</small>
              </span>
              <span class="scene-state" aria-hidden="true"></span>
            </button>
          {/each}
        </div>
      </section>

      <section class="mixer-panel liquid-panel" aria-labelledby="mixer-heading">
        <div class="section-heading mixer-heading">
          <div>
            <p class="kicker">Sound</p>
            <h2 id="mixer-heading">{activeTrack.title}</h2>
          </div>
          <span>{audioError || (audioLoading ? "Loading" : isAudioPlaying ? "Playing" : audioStarted ? "Paused" : "Ready")}</span>
        </div>

        <div class="main-transport">
          <button
            class="audio-button"
            class:playing={isAudioPlaying}
            type="button"
            aria-label={isAudioPlaying ? "Pause audio" : "Play audio"}
            on:click={toggleAudio}
          >
            <span class="audio-button-core">
              {#if isAudioPlaying}
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6v12M15.5 6v12" /></svg>
              {:else}
                <svg class="play-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 5.5 11 6.5-11 6.5v-13Z" /></svg>
              {/if}
            </span>
          </button>

          <div class:playing={isAudioPlaying} class="equalizer" role="img" aria-label="Live audio level">
            {#each visualLevels as level}
              <i style={`height: ${level}px; opacity: ${isAudioPlaying ? 0.72 + level / 120 : 0.38}`}></i>
            {/each}
          </div>

          <div class="now-playing">
            <strong>{activeTrack.title}</strong>
            <span>{activeTrack.note} · recorded ambience</span>
          </div>
        </div>

        <label class="volume-row">
          <span>Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            style={`--volume-percent: ${Math.round(volume * 100)}%`}
            aria-label="Audio volume"
            aria-valuetext={`${Math.round(volume * 100)} percent`}
            on:input={updateVolume}
          />
          <output>{Math.round(volume * 100)}</output>
        </label>

        <div class="option-section">
          <div class="option-heading">
            <h3>Audio layers</h3>
            <span>5 tracks</span>
          </div>
          {#key activeScene.id}
            <div class="track-grid option-grid-enter">
              {#each activeScene.audioTracks as track, index (track.id)}
                <button
                  type="button"
                  class="track-card"
                  class:active={selectedAudio === index}
                  aria-pressed={selectedAudio === index}
                  on:click={() => selectTrack(index)}
                >
                  <span class="track-number">0{index + 1}</span>
                  <span><strong>{track.title}</strong><small>{track.note}</small></span>
                </button>
              {/each}
            </div>
          {/key}
        </div>

        <div class="option-section video-section">
          <div class="option-heading">
            <h3>Video loops</h3>
            <span>4 views</span>
          </div>
          {#key activeScene.id}
            <div class="video-grid option-grid-enter">
              {#each activeScene.videoLoops as loop, index (loop.id)}
                <button
                  type="button"
                  class="video-card"
                  class:active={selectedVideo === index}
                  aria-pressed={selectedVideo === index}
                  on:click={() => selectVideo(index)}
                >
                  <span>0{index + 1}</span>
                  <strong>{loop.title}</strong>
                </button>
              {/each}
            </div>
          {/key}
        </div>
      </section>
    </div>
  </main>
</div>

<style>
  .app-shell {
    min-height: 100svh;
    position: relative;
    color: #f7f7f4;
    isolation: isolate;
    transition: --accent 480ms ease;
  }

  .topbar {
    position: fixed;
    z-index: 20;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22px clamp(18px, 3.5vw, 52px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
    background:
      linear-gradient(180deg, rgba(10, 13, 15, 0.58), rgba(10, 13, 15, 0.3)),
      radial-gradient(circle at 12% 0%, rgba(var(--accent-rgb), 0.075), transparent 44%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 12px 34px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(20px) saturate(145%);
    -webkit-backdrop-filter: blur(20px) saturate(145%);
    pointer-events: none;
  }

  .topbar > * { pointer-events: auto; }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .credits-link {
    color: rgba(255, 255, 255, 0.62);
    font-size: 0.73rem;
    letter-spacing: 0.04em;
    text-decoration: none;
    transition: color 180ms ease;
  }

  .credits-link:hover { color: #fff; }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: inherit;
    font-size: 0.72rem;
    font-weight: 680;
    letter-spacing: 0.19em;
    text-decoration: none;
  }

  .brand-icon {
    width: 30px;
    height: 30px;
    flex: 0 0 30px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 9px;
    background: rgba(8, 11, 14, 0.56);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 6px 18px rgba(0, 0, 0, 0.24), 0 0 20px rgba(var(--accent-rgb), 0.1);
    transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), border-color 220ms ease, box-shadow 300ms ease;
  }

  .wordmark:hover .brand-icon {
    transform: translateY(-1px) scale(1.04);
    border-color: rgba(var(--accent-rgb), 0.48);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 8px 22px rgba(0, 0, 0, 0.28), 0 0 24px rgba(var(--accent-rgb), 0.18);
  }

  .wordmark-copy {
    display: inline-flex;
    align-items: center;
    gap: 9px;
  }

  .wordmark i {
    width: 22px;
    height: 1px;
    background: linear-gradient(90deg, currentColor, var(--accent));
    opacity: 0.62;
  }

  .glass-button {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 15px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.76);
    background: rgba(24, 25, 27, 0.32);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 8px 30px rgba(0, 0, 0, 0.14);
    backdrop-filter: blur(22px) saturate(155%);
    -webkit-backdrop-filter: blur(22px) saturate(155%);
    cursor: pointer;
    transition: transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1), background 220ms ease, color 220ms ease;
  }

  .glass-button:hover { transform: translateY(-2px); color: #fff; background: rgba(255, 255, 255, 0.14); }
  .glass-button:active { transform: scale(0.96); }

  .video-toggle svg,
  .pip-toggle svg,
  .pip-options svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .pip-toggle.pip-active {
    color: #fff;
    border-color: rgba(var(--accent-rgb), 0.64);
    background: rgba(var(--accent-rgb), 0.16);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 8px 30px rgba(0, 0, 0, 0.18), 0 0 24px rgba(var(--accent-rgb), 0.12);
  }

  .pip-window-mark {
    fill: rgba(var(--accent-rgb), 0.52);
    stroke-width: 1.35;
  }

  .pip-control {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .pip-options {
    width: 36px;
    height: 40px;
    justify-content: center;
    padding: 0;
  }

  .pip-options.active {
    color: #fff;
    border-color: rgba(var(--accent-rgb), 0.5);
    background: rgba(var(--accent-rgb), 0.14);
  }

  .pip-toggle.pip-off {
    color: rgba(255, 255, 255, 0.48);
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(16, 18, 20, 0.54);
  }

  .pip-off-mark {
    stroke: rgba(255, 255, 255, 0.78);
    stroke-width: 2.1;
  }

  .pip-menu {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: min(320px, calc(100vw - 32px));
    display: grid;
    gap: 6px;
    padding: 10px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 22px;
    color: #f7f7f4;
    background: linear-gradient(145deg, rgba(29, 32, 35, 0.95), rgba(10, 12, 14, 0.92));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 24px 70px rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(28px) saturate(145%);
    -webkit-backdrop-filter: blur(28px) saturate(145%);
    transform-origin: top right;
    animation: pip-menu-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes pip-menu-in {
    from { opacity: 0; transform: translateY(-5px) scale(0.97); filter: blur(4px); }
    to { opacity: 1; transform: none; filter: none; }
  }

  .pip-menu-heading {
    display: grid;
    gap: 3px;
    padding: 9px 10px 8px;
  }

  .pip-menu-heading strong { font-size: 0.82rem; font-weight: 620; }
  .pip-menu-heading span { color: rgba(255, 255, 255, 0.45); font-size: 0.68rem; }

  .pip-menu > button {
    min-height: 52px;
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 9px 11px;
    border: 1px solid transparent;
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.68);
    background: transparent;
    cursor: pointer;
    text-align: left;
    transition: color 180ms ease, background 180ms ease, border-color 180ms ease, transform 180ms ease;
  }

  .pip-menu > button:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.07);
    transform: translateX(2px);
  }

  .pip-menu > button.active {
    color: #fff;
    border-color: rgba(var(--accent-rgb), 0.28);
    background: rgba(var(--accent-rgb), 0.12);
  }

  .pip-menu > button i {
    width: 8px;
    height: 8px;
    border: 1px solid rgba(255, 255, 255, 0.38);
    border-radius: 50%;
    box-shadow: 0 0 0 3px transparent;
  }

  .pip-menu > button.active i {
    border-color: var(--accent);
    background: var(--accent);
    box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.13);
  }

  .pip-menu > button span { display: grid; gap: 3px; }
  .pip-menu > button strong { font-size: 0.76rem; font-weight: 580; }
  .pip-menu > button small { color: rgba(255, 255, 255, 0.43); font-size: 0.65rem; }

  .pip-consent {
    position: fixed;
    z-index: 40;
    right: clamp(16px, 3.5vw, 52px);
    bottom: 24px;
    width: min(440px, calc(100vw - 32px));
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 14px;
    padding: 18px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 26px;
    color: #f7f7f4;
    background: linear-gradient(145deg, rgba(29, 32, 35, 0.93), rgba(10, 12, 14, 0.88));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 28px 90px rgba(0, 0, 0, 0.46), 0 0 48px rgba(var(--accent-rgb), 0.08);
    backdrop-filter: blur(28px) saturate(145%);
    -webkit-backdrop-filter: blur(28px) saturate(145%);
    animation: pip-consent-in 440ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes pip-consent-in {
    from { opacity: 0; transform: translateY(18px) scale(0.97); filter: blur(8px); }
    to { opacity: 1; transform: none; filter: none; }
  }

  .pip-consent-icon {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(var(--accent-rgb), 0.34);
    border-radius: 15px;
    color: var(--accent);
    background: rgba(var(--accent-rgb), 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }

  .pip-consent-icon svg,
  .pip-consent-close svg {
    width: 20px;
    height: 20px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .pip-consent h2 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 520;
    letter-spacing: -0.035em;
  }

  .pip-consent #pip-consent-copy {
    margin: 7px 28px 0 0;
    color: rgba(255, 255, 255, 0.56);
    font-size: 0.76rem;
    line-height: 1.5;
  }

  .pip-consent-close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.66);
    background: rgba(12, 14, 16, 0.55);
    cursor: pointer;
  }

  .pip-consent-close svg { width: 13px; height: 13px; }

  .pip-consent-actions {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    padding-top: 2px;
  }

  .pip-consent-actions button {
    min-height: 38px;
    padding: 9px 13px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.72);
    background: rgba(255, 255, 255, 0.06);
    cursor: pointer;
    transition: transform 180ms ease, color 180ms ease, background 180ms ease, border-color 180ms ease;
  }

  .pip-consent-actions button:hover { transform: translateY(-1px); color: #fff; border-color: rgba(var(--accent-rgb), 0.42); }
  .pip-consent-actions .pip-primary { color: #101214; border-color: transparent; background: rgba(var(--accent-rgb), 0.94); }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  main {
    position: relative;
    z-index: 3;
    width: min(1500px, 100%);
    margin: 0 auto;
    padding: 104px clamp(16px, 3.5vw, 52px) 42px;
  }

  .scene-hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 40px;
    min-height: 170px;
    margin-bottom: 28px;
    animation: hero-in 580ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes hero-in {
    from { opacity: 0; transform: translateY(18px); filter: blur(8px); }
    to { opacity: 1; transform: translateY(0); filter: blur(0); }
  }

  .eyebrow,
  .kicker {
    margin: 0 0 9px;
    color: rgba(255, 255, 255, 0.58);
    font-size: 0.69rem;
    font-weight: 680;
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }

  .kicker { color: rgba(var(--accent-rgb), 0.82); }

  h1 {
    position: relative;
    display: inline-block;
    margin: 0;
    font-size: clamp(4.4rem, 8vw, 8.7rem);
    font-weight: 390;
    line-height: 0.82;
    letter-spacing: -0.075em;
    text-shadow: 0 0 42px rgba(var(--accent-rgb), 0.12);
  }

  h1::after {
    content: "";
    position: absolute;
    inset: -0.04em -0.08em;
    pointer-events: none;
    opacity: 0.12;
    background: linear-gradient(112deg, transparent 18%, rgba(255, 255, 255, 0.72) 42%, rgba(var(--accent-rgb), 0.5) 49%, transparent 68%);
    mix-blend-mode: screen;
    filter: blur(7px);
    transform: skewX(-8deg);
  }

  .scene-hero > p {
    width: min(390px, 34vw);
    margin: 0 0 4px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.96rem;
    line-height: 1.55;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(540px, 1.25fr) minmax(390px, 0.8fr);
    align-items: start;
    gap: 18px;
  }

  .liquid-panel {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 32px;
    background:
      radial-gradient(circle at 14% 0%, rgba(var(--accent-rgb), 0.075), transparent 46%),
      linear-gradient(145deg, rgba(24, 27, 29, 0.5), rgba(11, 14, 16, 0.36));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 28px 90px rgba(0, 0, 0, 0.24), 0 0 70px rgba(var(--accent-rgb), 0.055);
    backdrop-filter: blur(24px) saturate(148%);
    -webkit-backdrop-filter: blur(24px) saturate(148%);
  }

  .liquid-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(115deg, rgba(255, 255, 255, 0.085), transparent 24% 72%, rgba(255, 255, 255, 0.025));
    mask-image: linear-gradient(#000, transparent 74%);
  }

  .library-panel,
  .mixer-panel { padding: clamp(20px, 2.2vw, 30px); }

  .section-heading,
  .option-heading {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
  }

  .section-heading { margin-bottom: 20px; }

  .section-heading h2,
  .option-heading h3 {
    margin: 0;
    font-weight: 480;
    letter-spacing: -0.035em;
  }

  .section-heading h2 { font-size: clamp(1.45rem, 2vw, 1.85rem); }
  .option-heading h3 { font-size: 0.86rem; letter-spacing: -0.01em; }

  .section-heading > span,
  .option-heading > span {
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .scene-grid {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .scene-card,
  .track-card,
  .video-card {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.72);
    background: rgba(22, 25, 27, 0.74);
    cursor: pointer;
    text-align: left;
    transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1), color 220ms ease, background 280ms ease, border-color 280ms ease, box-shadow 280ms ease;
  }

  .scene-card::before,
  .track-card::before,
  .video-card::before {
    content: "";
    position: absolute;
    inset: 0;
    opacity: 0;
    background: radial-gradient(circle at 15% 0%, rgba(255, 255, 255, 0.2), transparent 52%);
    transition: opacity 280ms ease;
  }

  .scene-card:hover,
  .track-card:hover,
  .video-card:hover {
    transform: translateY(-3px);
    color: #fff;
    border-color: rgba(var(--accent-rgb), 0.42);
    background: rgba(37, 41, 44, 0.86);
  }

  .scene-card:hover::before,
  .track-card:hover::before,
  .video-card:hover::before { opacity: 1; }

  .scene-card:active,
  .track-card:active,
  .video-card:active { transform: scale(0.975); }

  .scene-card {
    min-height: 88px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 19px;
  }

  .scene-card.active,
  .track-card.active,
  .video-card.active {
    color: #111315;
    border-color: rgba(var(--accent-rgb), 0.8);
    background: linear-gradient(145deg, rgba(248, 248, 244, 0.96), rgba(var(--accent-rgb), 0.82));
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16), 0 0 30px rgba(var(--accent-rgb), 0.13), inset 0 1px 0 white;
  }

  .track-number,
  .video-card > span {
    color: rgba(255, 255, 255, 0.35);
    font-size: 0.65rem;
    font-variant-numeric: tabular-nums;
  }

  .active .track-number,
  .video-card.active > span { color: rgba(17, 19, 21, 0.42); }

  .scene-card-copy,
  .track-card > span:last-child { display: grid; gap: 4px; min-width: 0; }
  .scene-card strong,
  .track-card strong,
  .video-card strong { position: relative; font-size: 0.87rem; font-weight: 540; line-height: 1.18; }
  .scene-card small,
  .track-card small { position: relative; color: rgba(255, 255, 255, 0.4); font-size: 0.68rem; }
  .scene-card.active small,
  .track-card.active small { color: rgba(17, 19, 21, 0.54); }

  .scene-state {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    box-shadow: 0 0 0 0 rgba(17, 19, 21, 0);
  }

  .scene-card.active .scene-state {
    background: var(--accent);
    animation: active-pulse 2.2s ease-out infinite;
  }

  @keyframes active-pulse {
    0% { box-shadow: 0 0 0 0 rgba(17, 19, 21, 0.26); }
    70%, 100% { box-shadow: 0 0 0 8px rgba(17, 19, 21, 0); }
  }

  .mixer-panel { animation: panel-rise 650ms 90ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  .library-panel { animation: panel-rise 650ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes panel-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }

  .mixer-heading { margin-bottom: 14px; }

  .main-transport {
    position: relative;
    min-height: 132px;
    display: grid;
    grid-template-columns: auto 1fr;
    align-items: center;
    column-gap: 18px;
    padding: 10px 0 14px;
  }

  .audio-button {
    grid-row: 1 / 3;
    width: 96px;
    height: 96px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    background: rgba(28, 31, 33, 0.82);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.58);
    backdrop-filter: blur(14px);
    cursor: pointer;
    transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1), background 260ms ease, box-shadow 260ms ease;
  }

  .audio-button:hover { transform: scale(1.045); background: rgba(43, 47, 50, 0.92); }
  .audio-button:active { transform: scale(0.94); }
  .audio-button.playing { box-shadow: 0 0 0 7px rgba(var(--accent-rgb), 0.1), 0 16px 44px rgba(0, 0, 0, 0.24), 0 0 34px rgba(var(--accent-rgb), 0.16); }

  .audio-button-core {
    width: 70px;
    height: 70px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #111315;
    background: rgba(250, 250, 247, 0.96);
    box-shadow: 0 5px 16px rgba(0, 0, 0, 0.18);
  }

  .audio-button svg {
    width: 24px;
    height: 24px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .play-mark { margin-left: 2px; }

  .equalizer {
    height: 38px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-top: 10px;
  }

  .equalizer i {
    width: 3px;
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(to top, rgba(255, 255, 255, 0.5), var(--accent));
    transform-origin: center;
    transition: height 70ms linear, opacity 120ms ease, background 480ms ease;
  }

  .now-playing { display: grid; align-self: start; gap: 4px; }
  .now-playing strong { font-size: 0.9rem; font-weight: 560; }
  .now-playing span { color: rgba(255, 255, 255, 0.45); font-size: 0.69rem; }

  .volume-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 28px;
    align-items: center;
    gap: 13px;
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.64);
    background: rgba(22, 25, 27, 0.78);
    font-size: 0.74rem;
  }

  .volume-row input {
    appearance: none;
    -webkit-appearance: none;
    width: 100%;
    height: 32px;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 999px;
    outline: none;
    background: transparent;
    cursor: pointer;
    touch-action: pan-y;
  }

  .volume-row input::-webkit-slider-runnable-track {
    height: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background:
      linear-gradient(90deg, rgba(var(--accent-rgb), 0.92) 0 var(--volume-percent), rgba(255, 255, 255, 0.1) var(--volume-percent) 100%);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.38), 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .volume-row input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    margin-top: -7px;
    border: 1px solid rgba(255, 255, 255, 0.68);
    border-radius: 50%;
    background:
      radial-gradient(circle at 36% 30%, #fff 0 18%, rgba(255, 255, 255, 0.93) 44%, rgba(var(--accent-rgb), 0.9) 100%);
    box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.12), 0 5px 14px rgba(0, 0, 0, 0.42), inset 0 1px 0 #fff;
    transition: transform 160ms ease, box-shadow 260ms ease;
  }

  .volume-row input::-moz-range-track {
    height: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.38);
  }

  .volume-row input::-moz-range-progress {
    height: 8px;
    border-radius: 999px;
    background: rgba(var(--accent-rgb), 0.92);
  }

  .volume-row input::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border: 1px solid rgba(255, 255, 255, 0.68);
    border-radius: 50%;
    background: rgba(var(--accent-rgb), 0.96);
    box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.12), 0 5px 14px rgba(0, 0, 0, 0.42), inset 0 1px 0 #fff;
    transition: transform 160ms ease, box-shadow 260ms ease;
  }

  .volume-row input:hover::-webkit-slider-thumb,
  .volume-row input:focus-visible::-webkit-slider-thumb { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(var(--accent-rgb), 0.18), 0 6px 18px rgba(0, 0, 0, 0.46), inset 0 1px 0 #fff; }
  .volume-row input:hover::-moz-range-thumb,
  .volume-row input:focus-visible::-moz-range-thumb { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(var(--accent-rgb), 0.18), 0 6px 18px rgba(0, 0, 0, 0.46), inset 0 1px 0 #fff; }
  .volume-row input:active::-webkit-slider-thumb { transform: scale(0.92); }
  .volume-row input:active::-moz-range-thumb { transform: scale(0.92); }
  .volume-row output { color: rgba(255, 255, 255, 0.88); font-variant-numeric: tabular-nums; text-align: right; }

  .option-section { margin-top: 24px; }
  .option-heading { align-items: center; margin-bottom: 10px; padding: 0 2px; }
  .track-grid,
  .video-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }

  .option-grid-enter { animation: options-in 480ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes options-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .track-card {
    min-height: 62px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 11px;
    border-radius: 16px;
  }

  .track-card:last-child:nth-child(odd) { grid-column: 1 / -1; }

  .video-section { padding-top: 21px; border-top: 1px solid rgba(255, 255, 255, 0.1); }

  .video-card {
    min-height: 58px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 10px;
    padding: 11px;
    border-radius: 15px;
  }

  .video-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.76rem; }

  @media (min-width: 1121px) {
    .library-panel {
      position: sticky;
      top: 80px;
      align-self: start;
    }
  }

  @media (max-width: 1120px) {
    .workspace { grid-template-columns: 1fr; }
    .mixer-panel { order: -1; }
    .scene-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }

  @media (max-width: 760px) {
    .topbar { padding: 18px 16px; }
    .credits-link { display: none; }
    .video-toggle span,
    .pip-toggle span { display: none; }
    .topbar-actions { gap: 7px; }
    .video-toggle,
    .pip-toggle { width: 42px; height: 42px; justify-content: center; padding: 0; }
    .pip-options { width: 34px; height: 42px; }
    .pip-menu { position: fixed; top: 70px; right: 16px; }
    .pip-consent { left: 12px; right: 12px; bottom: 12px; width: auto; padding: 16px; border-radius: 23px; }
    .pip-consent-actions { display: grid; grid-template-columns: 1fr 1fr; }
    .pip-consent-actions .pip-primary { grid-column: 1 / -1; }
    .pip-consent-actions button { width: 100%; }
    main { padding: 88px 12px 28px; }
    .scene-hero { min-height: 140px; display: block; margin: 0 8px 24px; }
    h1 { font-size: clamp(4rem, 21vw, 6.3rem); }
    .scene-hero > p { width: min(100%, 420px); margin-top: 22px; font-size: 0.9rem; }
    .liquid-panel { border-radius: 26px; }
    .library-panel, .mixer-panel { padding: 18px; }
    .mixer-panel { display: block; }
    .library-panel { order: -2; }
    .mixer-panel { order: -1; }
    .scene-grid {
      grid-template-columns: none;
      grid-template-rows: repeat(2, 76px);
      grid-auto-flow: column;
      grid-auto-columns: minmax(150px, 44vw);
      overflow-x: auto;
      padding: 2px 1px 8px;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
    }
    .scene-grid::-webkit-scrollbar { display: none; }
    .track-grid, .video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .scene-card { min-height: 78px; padding: 11px; gap: 9px; }
    .scene-card { min-height: 0; scroll-snap-align: start; }
    .scene-card small { display: none; }
    .scene-card strong { font-size: 0.8rem; }
    .audio-button { width: 88px; height: 88px; }
    .audio-button-core { width: 64px; height: 64px; }
    .track-card:last-child:nth-child(odd) { grid-column: auto; }
  }

  @media (max-width: 420px) {
    .wordmark { gap: 7px; font-size: 0.65rem; letter-spacing: 0.15em; }
    .brand-icon { width: 26px; height: 26px; flex-basis: 26px; border-radius: 8px; }
    .wordmark-copy { gap: 6px; }
    .wordmark i { width: 16px; }
    .scene-hero > p { display: none; }
    .scene-hero { min-height: 106px; }
    .scene-grid { gap: 6px; }
    .track-grid { grid-template-columns: 1fr; }
    .track-card:last-child:nth-child(odd) { grid-column: auto; }
    .video-card strong { font-size: 0.72rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
</style>
