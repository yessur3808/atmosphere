<script>
  import { onDestroy, onMount, tick } from "svelte";
  import AmbientStatus from "./components/AmbientStatus.svelte";
  import Background from "./components/Background.svelte";
  import AtmosphereIcon from "./components/AtmosphereIcon.svelte";
  import { destroyAnalytics, getAnalyticsStatus, initializeAnalytics, setAnalyticsConsent, trackEvent } from "./analytics";
  import {
    decodeMixSnapshot,
    encodeMixSnapshot,
    filterSceneLibrary,
    normalizeMixSnapshot,
    sortSavedMixes,
    upsertRecentMix,
  } from "./mixState.mjs";
  import { createMiniPlayer } from "./miniPlayer";
  import { initializeDesktopRuntime } from "./desktopRuntime";
  import { scenes } from "./sceneLibrary";
  import { mediaUrl, siteUrl } from "./siteUrl.mjs";
  import { weatherAtmosphereProfile } from "./weather.mjs";

  let audioElements = [];
  let backgroundComponent;
  let ambientStatusComponent;
  let activeIndex = 0;
  let selectedAudio = 0;
  let selectedAudios = [0];
  let selectedVideo = 0;
  let selectedSoundCategory = "";
  let audioStarted = false;
  let isAudioPlaying = false;
  let isVideoPlaying = false;
  let volume = 0.52;
  let audioLoading = false;
  let audioError = "";
  let audioContext;
  let mediaSources = [];
  let layerGainNodes = [];
  let masterGainNode;
  let limiterNode;
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
  let pipPromptVisible = false;
  let pipControlsAvailable = false;
  let settingsOpen = false;
  let settingsTab = "playback";
  let linkedPlayback = true;
  let multiSoundEnabled = false;
  let immersiveMode = false;
  let recipesOpen = false;
  let mixDrawerTab = "for-you";
  let mixIntent = "all";
  let mixEditorOpen = false;
  let playerDetailsOpen = false;
  let analyticsConfigured = false;
  let analyticsConsent = "unset";
  let layerVolumes = {};
  let smartMixMultipliers = {};
  let smartMixEnabled = false;
  let smartMixTimer;
  let dataSaverMode = false;
  let savedMixes = [];
  let recentMixes = [];
  let favoriteSceneIds = [];
  let libraryQuery = "";
  let libraryCategory = "all";
  let libraryToolsOpen = false;
  let libraryExpanded = false;
  let localWeather;
  let weatherUiState = "idle";
  let weatherMatchRequested = false;
  let weatherMatchActive = false;
  let weatherMode = "match";
  let weatherSoundStrength = "realistic";
  let weatherAutoMatch = true;
  let weatherFollowTime = true;
  let weatherCityQuery = "";
  let weatherCityBusy = false;
  let activeWeatherProfile;
  let saveMixOpen = false;
  let saveMixName = "";
  let toastMessage = "";
  let toastTimer;
  let persistenceTimer;
  let hydrated = false;
  let desktopRuntimeCleanup;
  let settingsPageLocked = false;
  let settingsPageScrollY = 0;
  let settingsBodyStyles;

  const preferencesStorageKey = "atmosphere-preferences-v2";
  const legacyPreferencesStorageKey = "atmosphere-preferences-v1";
  const savedMixesStorageKey = "atmosphere-saved-mixes-v1";
  const recentMixesStorageKey = "atmosphere-recent-mixes-v1";
  const favoriteScenesStorageKey = "atmosphere-favorite-scenes-v1";
  const resumeStorageKey = "atmosphere-resume-v1";
  const audioCrossfadeMilliseconds = 760;
  const smartMixIntervalMilliseconds = 12000;
  const nativeVolumeFrames = new WeakMap();
  const mixIntents = ["all", "focus", "relax", "sleep", "nature"];
  const settingsTabs = [
    { id: "playback", title: "Playback" },
    { id: "mixes", title: "My mixes" },
    { id: "weather", title: "Live weather" },
    { id: "display", title: "Display" },
    { id: "mini-player", title: "Mini player" },
    { id: "privacy", title: "Privacy" },
    { id: "about", title: "About" },
  ];
  const recipeBlueprints = [
    { id: "office-focus", title: "Office focus", intent: "focus", detail: "A steady foundation with just enough natural detail to stay attentive.", indices: [0, 2] },
    { id: "gentle-depth", title: "Gentle depth", intent: "relax", detail: "A softer two-layer blend for reading, journaling, and unwinding.", indices: [1, 4] },
    { id: "full-atmosphere", title: "Full atmosphere", intent: "nature", detail: "A richer three-part soundscape that fills the room without feeling busy.", indices: [0, 2, 3] },
    { id: "hotel-lobby", title: "Hotel lobby", intent: "focus", detail: "Classic elevator jazz with a restrained layer of distant lobby conversation.", sceneId: "tab_elevator_music", indices: [0, 5], volumes: [0.78, 0.24] },
    { id: "cozy-cabin", title: "Cozy cabin", intent: "relax", detail: "A sheltered hearth while snow and winter air move outside.", sceneId: "tab_snow", indices: [0, 1, 5], volumes: [0.34, 0.28, 0.82] },
    { id: "midnight-reading", title: "Midnight reading", intent: "focus", detail: "Pages, a low fire, and rain against the library windows.", sceneId: "tab_library", indices: [0, 3, 5], volumes: [0.46, 0.62, 0.42] },
    { id: "rainy-commute", title: "Rainy commute", intent: "focus", detail: "A steady carriage rhythm carried through rain and passing roads.", sceneId: "tab_train", indices: [0, 5, 6], volumes: [0.72, 0.44, 0.22] },
    { id: "deep-office-focus", title: "Deep office focus", intent: "focus", detail: "Measured keys over brown noise and a distant office murmur.", sceneId: "tab_typing", indices: [0, 5, 6], volumes: [0.48, 0.68, 0.2] },
    { id: "forest-stream", title: "Forest stream", intent: "nature", detail: "Birds, moving canopy, and water heard deeper among the trees.", sceneId: "tab_forest", indices: [0, 1, 4], volumes: [0.38, 0.46, 0.66] },
    { id: "storm-watching", title: "Storm watching", intent: "relax", detail: "Distant thunder and layered rain from a safe place indoors.", sceneId: "tab_lightning", indices: [0, 1, 4], volumes: [0.58, 0.5, 0.32] },
    { id: "spa-retreat", title: "Spa retreat", intent: "relax", detail: "Thermal water, morning birds, and cool mountain air.", sceneId: "tab_onsen", indices: [0, 3, 4], volumes: [0.68, 0.34, 0.28] },
    { id: "cat-nap", title: "Cat nap", intent: "sleep", detail: "A close purr beside window rain and a compact fireplace.", sceneId: "tab_cat_window", indices: [0, 1, 2], volumes: [0.78, 0.38, 0.3] },
  ];

  const pipPreferences = [
    { id: "automatic", title: "Automatic", detail: "Use floating PiP when your browser supports it" },
    { id: "manual", title: "Manual only", detail: "Open only when you press the button" },
    { id: "off", title: "Off", detail: "Never open the mini player" },
  ];

  function isAppleMobileDevice() {
    const platform = navigator.userAgentData?.platform || navigator.platform || "";
    const touchEnabledMac = platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/i.test(navigator.userAgent) || touchEnabledMac;
  }
  const homeHref = siteUrl("");
  const faviconHref = siteUrl("favicon-v2.png");
  const creditsHref = siteUrl("audio-credits.html");
  const videoCreditsHref = siteUrl("video-credits.html");
  const installHref = siteUrl("install.html");
  const privacyHref = siteUrl("privacy.html");
  const termsHref = siteUrl("terms.html");
  const securityHref = siteUrl("security.html");
  const licensesHref = siteUrl("licenses.html");
  const accessibilityHref = siteUrl("accessibility.html");

  $: activeScene = scenes[activeIndex];
  $: activeSoundCategories = activeScene.subcategories || [];
  $: if (!activeSoundCategories.some((subcategory) => subcategory.id === selectedSoundCategory)) {
    selectedSoundCategory = activeSoundCategories[0]?.id || "";
  }
  $: activeSoundCategory = activeSoundCategories.find((subcategory) => subcategory.id === selectedSoundCategory);
  $: visibleAudioTracks = activeScene.audioTracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => !activeSoundCategory || track.subcategory === activeSoundCategory.id);
  $: visibleVideoLoops = activeScene.videoLoops
    .map((loop, index) => ({ loop, index }))
    .filter(({ loop }) => !activeSoundCategory || loop.subcategory === activeSoundCategory.id);
  $: activeTrack = activeScene.audioTracks[selectedAudio];
  $: activeVideo = activeScene.videoLoops[selectedVideo];
  $: selectedTrackNames = selectedAudios.map((index) => activeScene.audioTracks[index]?.title).filter(Boolean);
  $: mixTitle = selectedAudios.length > 1 ? `${selectedAudios.length} sounds mixed` : activeTrack.title;
  $: mixNote = selectedAudios.length > 1 ? selectedTrackNames.join(" + ") : `${activeTrack.note} · ${activeTrack.kind === "music" ? "instrumental music" : "recorded ambience"}`;
  $: soundRecipes = recipeBlueprints.filter((recipe) => recipe.sceneId || activeScene.id !== "tab_elevator_music").map((recipe) => {
    const recipeSceneIndex = recipe.sceneId ? scenes.findIndex((scene) => scene.id === recipe.sceneId) : activeIndex;
    const recipeScene = scenes[recipeSceneIndex] || activeScene;
    return {
      ...recipe,
      sceneIndex: recipeSceneIndex,
      tracks: recipe.indices.map((index) => recipeScene.audioTracks[index]).filter(Boolean),
    };
  });
  $: visibleSoundRecipes = mixIntent === "all" ? soundRecipes : soundRecipes.filter((recipe) => recipe.intent === mixIntent);
  $: sceneCategories = ["all", "favorites", ...new Set(scenes.map((scene) => scene.category))];
  $: filteredScenes = filterSceneLibrary(scenes, libraryQuery, libraryCategory, favoriteSceneIds);
  $: weatherCardVisible = ["all", "Weather"].includes(libraryCategory)
    && (!libraryQuery.trim() || ["live", "weather", "outside", localWeather?.label, localWeather?.locationLabel].filter(Boolean).join(" ").toLowerCase().includes(libraryQuery.trim().toLowerCase()));
  $: currentSceneFavorite = favoriteSceneIds.includes(activeScene.id);
  $: visibleSettingsTabs = pipControlsAvailable
    ? settingsTabs
    : settingsTabs.filter((tab) => tab.id !== "mini-player");
  $: transportMediaLabel = dataSaverMode || !linkedPlayback ? "audio" : "audio and video";
  $: miniPlayerSnapshot = {
    sceneTitle: activeScene.title,
    category: activeScene.category,
    accent: activeScene.accent,
    accentRgb: activeScene.accentRgb,
    trackTitle: mixTitle,
    trackNote: selectedAudios.length > 1 ? selectedTrackNames.join(" + ") : activeTrack.note,
    isAudioPlaying,
    isVideoPlaying,
    volume,
    visualLevels,
    videoPosition: activeVideo.position,
    videoScale: activeVideo.scale,
    poster: mediaUrl(`assets/videos/${activeVideo.poster}`),
    video: dataSaverMode ? undefined : backgroundComponent?.getVideoElement(),
    pipPreference,
    dataSaverMode,
  };
  $: if (miniPlayerController && miniPlayerSnapshot) {
    backgroundComponent?.setAutoPictureInPicture(!dataSaverMode && isAudioPlaying && pipPreference === "automatic");
    miniPlayerController.sync(miniPlayerSnapshot);
  }

  function getAnalyticsContext() {
    return {
      sceneId: activeScene?.id,
      sceneTitle: activeScene?.title,
      trackId: selectedAudios.map((index) => activeScene?.audioTracks[index]?.id).filter(Boolean).join(","),
      activeSoundCount: selectedAudios.length,
      soundCategory: selectedSoundCategory || undefined,
      videoId: activeVideo?.id,
      linkedPlayback,
      immersiveMode,
      isAudioPlaying,
    };
  }

  function updateAnalyticsPreference(nextConsent) {
    const status = setAnalyticsConsent(nextConsent);
    analyticsConfigured = status.configured;
    analyticsConsent = status.consent;
  }

  function handleAudioError(track) {
    audioLoading = false;
    audioError = `${track.title} is unavailable`;
    trackEvent("audio_error", { failed_track_id: track.id, failed_track_title: track.title });
  }

  function wait(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function getTrackId(index, scene = activeScene) {
    return scene?.audioTracks[index]?.id;
  }

  function getLayerVolume(index, scene = activeScene) {
    const trackId = getTrackId(index, scene);
    const savedVolume = trackId ? Number(layerVolumes[trackId]) : NaN;
    return Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : 1;
  }

  function getSmartMixMultiplier(index) {
    const multiplier = Number(smartMixMultipliers[getTrackId(index)]);
    return smartMixEnabled && Number.isFinite(multiplier) ? multiplier : 1;
  }

  function targetLayerGain(index) {
    return selectedAudios.includes(index) ? getLayerVolume(index) * getSmartMixMultiplier(index) : 0;
  }

  function rampNativeVolume(element, target, duration = 180) {
    if (!element) return;
    cancelAnimationFrame(nativeVolumeFrames.get(element));
    const startedAt = performance.now();
    const initial = Number.isFinite(element.volume) ? element.volume : 0;
    const clampedTarget = Math.max(0, Math.min(1, target));
    const frame = (now) => {
      const progress = duration ? Math.min(1, (now - startedAt) / duration) : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      element.volume = initial + (clampedTarget - initial) * eased;
      if (progress < 1) nativeVolumeFrames.set(element, requestAnimationFrame(frame));
    };
    nativeVolumeFrames.set(element, requestAnimationFrame(frame));
  }

  function ensureAudioGraph() {
    if (masterGainNode || graphUnavailable || !audioElements.length) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      graphUnavailable = true;
      return;
    }

    try {
      audioContext = new AudioContext();
      masterGainNode = audioContext.createGain();
      limiterNode = audioContext.createDynamicsCompressor();
      limiterNode.threshold.value = -7;
      limiterNode.knee.value = 7;
      limiterNode.ratio.value = 14;
      limiterNode.attack.value = 0.004;
      limiterNode.release.value = 0.24;
      analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 128;
      analyserNode.smoothingTimeConstant = 0.82;
      analyserData = new Uint8Array(analyserNode.frequencyBinCount);
      layerGainNodes = [];
      mediaSources = audioElements.filter(Boolean).map((element, index) => {
        const source = audioContext.createMediaElementSource(element);
        const layerGain = audioContext.createGain();
        layerGain.gain.value = targetLayerGain(index);
        source.connect(layerGain);
        layerGain.connect(masterGainNode);
        layerGainNodes[index] = layerGain;
        element.volume = 1;
        return source;
      });
      masterGainNode.connect(limiterNode);
      limiterNode.connect(analyserNode);
      analyserNode.connect(audioContext.destination);
      masterGainNode.gain.value = volume;
    } catch (error) {
      graphUnavailable = true;
      masterGainNode = undefined;
      limiterNode = undefined;
      analyserNode = undefined;
    }
  }

  async function resumeAudioGraph() {
    ensureAudioGraph();
    if (audioContext?.state === "suspended") {
      try { await audioContext.resume(); } catch (error) { /* Native media volume remains available. */ }
    }
  }

  function applyVolume(duration = 120) {
    if (!audioElements.length) return;
    if (masterGainNode && audioContext) {
      audioElements.filter(Boolean).forEach((element) => (element.volume = 1));
      masterGainNode.gain.cancelScheduledValues(audioContext.currentTime);
      masterGainNode.gain.setValueAtTime(masterGainNode.gain.value, audioContext.currentTime);
      masterGainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + duration / 1000);
      layerGainNodes.forEach((gainNode, index) => {
        if (!gainNode) return;
        gainNode.gain.cancelScheduledValues(audioContext.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(targetLayerGain(index), audioContext.currentTime + duration / 1000);
      });
    } else {
      audioElements.filter(Boolean).forEach((element, index) => {
        const target = volume * targetLayerGain(index);
        rampNativeVolume(element, target, duration);
      });
    }
  }

  async function fadeMasterTo(target, duration = audioCrossfadeMilliseconds) {
    const clampedTarget = Math.max(0, Math.min(1, target));
    if (masterGainNode && audioContext) {
      masterGainNode.gain.cancelScheduledValues(audioContext.currentTime);
      masterGainNode.gain.setValueAtTime(masterGainNode.gain.value, audioContext.currentTime);
      masterGainNode.gain.linearRampToValueAtTime(clampedTarget, audioContext.currentTime + duration / 1000);
    } else {
      audioElements.filter(Boolean).forEach((element, index) => {
        const layerTarget = clampedTarget ? clampedTarget * targetLayerGain(index) : 0;
        rampNativeVolume(element, layerTarget, duration);
      });
    }
    await wait(duration);
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

  function syncAudioPlaybackState() {
    const playing = audioElements.some((element, index) => selectedAudios.includes(index) && element && !element.paused);
    isAudioPlaying = playing;
    audioLoading = false;
    if (playing) startVisualizer();
    else {
      isVideoPlaying = false;
      stopVisualizer();
    }
  }

  function pauseAllAudio() {
    audioElements.filter(Boolean).forEach((element) => element.pause());
    isAudioPlaying = false;
    isVideoPlaying = false;
    stopVisualizer();
    refreshSmartMixSchedule();
  }

  async function fadeAndPauseAllAudio(duration = 260) {
    if (!isAudioPlaying) return pauseAllAudio();
    await fadeMasterTo(0, duration);
    pauseAllAudio();
  }

  async function playSelectedTracks(indices = selectedAudios, playbackSource = "interface") {
    const nextSelection = [...new Set(indices)].filter((index) => activeScene.audioTracks[index]);
    if (!nextSelection.length) return;
    const previousPlaying = audioElements.map((element) => Boolean(element && !element.paused));
    selectedAudios = nextSelection;
    selectedAudio = nextSelection.includes(selectedAudio) ? selectedAudio : nextSelection[0];
    nextSelection.forEach((index) => {
      const trackId = getTrackId(index);
      if (trackId && !Number.isFinite(Number(layerVolumes[trackId]))) {
        layerVolumes = { ...layerVolumes, [trackId]: nextSelection.length > 1 ? 0.72 : 1 };
      }
    });
    audioLoading = true;
    audioError = "";
    await tick();
    await resumeAudioGraph();

    const attempts = audioElements.map(async (element, index) => {
      if (!element) return false;
      if (!nextSelection.includes(index)) {
        return false;
      }
      const track = activeScene.audioTracks[index];
      if (!element.currentSrc.endsWith(track.src)) {
        element.src = track.src;
        element.load();
      }
      if (!previousPlaying[index] && !masterGainNode) element.volume = 0;
      if (!previousPlaying[index] && layerGainNodes[index] && audioContext) {
        layerGainNodes[index].gain.cancelScheduledValues(audioContext.currentTime);
        layerGainNodes[index].gain.setValueAtTime(0, audioContext.currentTime);
      }
      await element.play();
      return true;
    });

    const results = await Promise.allSettled(attempts);
    const started = results.some((result) => result.status === "fulfilled" && result.value);
    if (started) {
      applyVolume(audioCrossfadeMilliseconds);
      window.setTimeout(() => {
        audioElements.forEach((element, index) => {
          if (element && !nextSelection.includes(index)) element.pause();
        });
      }, audioCrossfadeMilliseconds + 40);
      audioStarted = true;
      isAudioPlaying = true;
      if (linkedPlayback) isVideoPlaying = !dataSaverMode;
      audioLoading = false;
      startVisualizer();
      recordRecentSession(playbackSource);
      queuePersistSession();
      refreshSmartMixSchedule();
      trackEvent("playback_start", {
        control_source: playbackSource,
        video_linked: linkedPlayback,
        selected_track_ids: selectedAudios.map((index) => activeScene.audioTracks[index]?.id).filter(Boolean).join(","),
      });
      if (pipControlsAvailable && pipPreference === "ask") pipPromptVisible = true;
    } else {
      isAudioPlaying = false;
      audioLoading = false;
      audioError = "Audio could not start";
    }
  }

  async function togglePlayback(source = "main_transport") {
    const controlSource = typeof source === "string" ? source : "main_transport";
    if (isAudioPlaying) {
      await fadeAndPauseAllAudio();
      trackEvent("playback_pause", { control_source: controlSource, video_linked: linkedPlayback });
      return;
    }
    if (linkedPlayback) isVideoPlaying = !dataSaverMode;
    await playSelectedTracks(selectedAudios, controlSource);
  }

  async function setAudioPlaying(shouldPlay, source = "interface") {
    if (shouldPlay && !isAudioPlaying) await playSelectedTracks(selectedAudios, source);
    else if (!shouldPlay && isAudioPlaying) {
      await fadeAndPauseAllAudio();
      trackEvent("playback_pause", { control_source: source, video_linked: false });
    }
  }

  async function setMiniPlayerPlayback(shouldPlay) {
    const video = dataSaverMode ? undefined : backgroundComponent?.getVideoElement();
    isVideoPlaying = dataSaverMode ? false : shouldPlay;

    if (!shouldPlay) {
      await fadeAndPauseAllAudio();
      video?.pause();
      trackEvent("playback_pause", { control_source: "mini_player", video_linked: true });
      return;
    }

    const videoPlayback = video?.play?.().catch(() => {});
    await Promise.allSettled([setAudioPlaying(true, "mini_player"), videoPlayback]);
  }

  async function previousAudioTrack() {
    const nextIndex = (selectedAudio - 1 + activeScene.audioTracks.length) % activeScene.audioTracks.length;
    await selectTrack(nextIndex, true);
  }

  async function nextAudioTrack() {
    const nextIndex = (selectedAudio + 1) % activeScene.audioTracks.length;
    await selectTrack(nextIndex, true);
  }

  async function selectScene(index, selectionSource = "library", resumeWithDefault = true) {
    const continuePlaying = isAudioPlaying;
    const previousScene = activeScene;
    if (selectionSource !== "weather_match") weatherMatchActive = false;
    if (continuePlaying) await fadeAndPauseAllAudio(audioCrossfadeMilliseconds / 2);
    else pauseAllAudio();
    activeIndex = index;
    selectedAudio = 0;
    selectedAudios = [0];
    selectedVideo = 0;
    selectedSoundCategory = scenes[index].subcategories?.[0]?.id || "";
    isVideoPlaying = false;
    const firstTrackId = scenes[index].audioTracks[0]?.id;
    if (firstTrackId && !Number.isFinite(Number(layerVolumes[firstTrackId]))) {
      layerVolumes = { ...layerVolumes, [firstTrackId]: 1 };
    }
    audioError = "";
    trackEvent("atmosphere_select", {
      previous_scene_id: previousScene?.id,
      selected_scene_id: scenes[index].id,
      selected_scene_title: scenes[index].title,
      continued_playback: continuePlaying,
      selection_source: selectionSource,
    });
    await tick();
    if (continuePlaying && resumeWithDefault) {
      await playSelectedTracks([0], "atmosphere_change");
    }
    queuePersistSession();
    return continuePlaying;
  }

  function handleWeatherState(event) {
    weatherUiState = event.detail?.state || "idle";
    if (["denied", "secure", "unavailable"].includes(weatherUiState)) weatherMatchRequested = false;
  }

  async function applyLiveWeather(weather = localWeather, source = "weather_match") {
    if (!weather) return;
    const profile = weatherAtmosphereProfile(weather, {
      mode: weatherMode,
      strength: weatherSoundStrength,
      followTime: weatherFollowTime,
    });
    const sceneIndex = scenes.findIndex((scene) => scene.id === profile.sceneId);
    if (sceneIndex < 0) return;

    const continuePlaying = await selectScene(sceneIndex, "weather_match", false);
    const matchedScene = scenes[sceneIndex];
    const nextIndices = profile.indices.filter((index) => matchedScene.audioTracks[index]);
    selectedAudios = nextIndices.length ? nextIndices : [0];
    selectedAudio = selectedAudios[0];
    multiSoundEnabled = selectedAudios.length > 1;
    selectedVideo = profile.videoSeed % matchedScene.videoLoops.length;
    selectedAudios.forEach((index, position) => {
      const trackId = getTrackId(index, matchedScene);
      if (trackId) layerVolumes = { ...layerVolumes, [trackId]: profile.volumes[position] ?? 0.62 };
    });
    activeWeatherProfile = profile;
    weatherMatchActive = true;
    isVideoPlaying = false;
    savePreferences();
    await tick();
    if (continuePlaying) await playSelectedTracks(selectedAudios, source);
    else showToast(`${profile.title} · Press play when you’re ready`);
    trackEvent("weather_match_apply", {
      weather_condition: weather.label.toLowerCase().replaceAll(" ", "_"),
      weather_mode: weatherMode,
      weather_sound_strength: weatherSoundStrength,
      matched_scene_id: profile.sceneId,
      active_sound_count: selectedAudios.length,
      update_source: source,
    });
    queuePersistSession();
  }

  async function handleWeatherUpdate(event) {
    localWeather = event.detail;
    weatherUiState = "ready";
    const shouldMatch = weatherMatchRequested || (weatherMatchActive && weatherAutoMatch);
    const source = weatherMatchRequested ? "weather_match" : "weather_auto_refresh";
    weatherMatchRequested = false;
    if (shouldMatch) await applyLiveWeather(localWeather, source);
  }

  function requestLiveWeather() {
    weatherMatchRequested = true;
    weatherUiState = "locating";
    trackEvent("weather_match_request", { weather_mode: weatherMode, request_source: "library_card" });
    ambientStatusComponent?.requestLocalWeather(true);
  }

  async function requestCityWeather() {
    if (weatherCityBusy) return;
    weatherMatchRequested = true;
    weatherCityBusy = true;
    const matched = await ambientStatusComponent?.requestCityWeather(weatherCityQuery, true);
    weatherCityBusy = false;
    if (matched) weatherCityQuery = "";
    else weatherMatchRequested = false;
  }

  async function setWeatherMode(nextMode) {
    weatherMode = nextMode === "comfort" ? "comfort" : "match";
    savePreferences();
    trackEvent("weather_mode_preference", { weather_mode: weatherMode });
    if (weatherMatchActive && localWeather) await applyLiveWeather(localWeather, "weather_preference_change");
  }

  async function setWeatherSoundStrength(nextStrength) {
    if (!["subtle", "realistic", "immersive"].includes(nextStrength)) return;
    weatherSoundStrength = nextStrength;
    savePreferences();
    trackEvent("weather_strength_preference", { weather_sound_strength: nextStrength });
    if (weatherMatchActive && localWeather) await applyLiveWeather(localWeather, "weather_preference_change");
  }

  function setWeatherAutoMatch(enabled) {
    weatherAutoMatch = enabled;
    savePreferences();
    trackEvent("weather_auto_match_preference", { enabled });
  }

  async function setWeatherFollowTime(enabled) {
    weatherFollowTime = enabled;
    savePreferences();
    trackEvent("weather_follow_time_preference", { enabled });
    if (weatherMatchActive && localWeather) await applyLiveWeather(localWeather, "weather_preference_change");
  }

  async function selectTrack(index, replaceSelection = false) {
    const continuePlaying = isAudioPlaying;
    selectedAudio = index;
    audioError = "";

    if (multiSoundEnabled && !replaceSelection) {
      if (selectedAudios.includes(index) && selectedAudios.length > 1) {
        selectedAudios = selectedAudios.filter((trackIndex) => trackIndex !== index);
        selectedAudio = selectedAudios[0];
      } else if (!selectedAudios.includes(index)) {
        selectedAudios = [...selectedAudios, index];
        const trackId = getTrackId(index);
        if (trackId && !Number.isFinite(Number(layerVolumes[trackId]))) {
          layerVolumes = { ...layerVolumes, [trackId]: 0.72 };
        }
      }
    } else {
      selectedAudios = [index];
      const trackId = getTrackId(index);
      if (trackId && !Number.isFinite(Number(layerVolumes[trackId]))) {
        layerVolumes = { ...layerVolumes, [trackId]: 1 };
      }
    }

    if (continuePlaying) {
      await playSelectedTracks(selectedAudios, "audio_layer_select");
    }
    trackEvent("audio_layer_select", {
      selected_track_id: activeScene.audioTracks[index]?.id,
      selected_track_title: activeScene.audioTracks[index]?.title,
      layer_action: selectedAudios.includes(index) ? "selected" : "removed",
      active_track_ids: selectedAudios.map((trackIndex) => activeScene.audioTracks[trackIndex]?.id).filter(Boolean).join(","),
    });
    queuePersistSession();
  }

  async function selectSoundCategory(subcategory) {
    if (!subcategory || subcategory.id === selectedSoundCategory) return;
    selectedSoundCategory = subcategory.id;
    const nextTrackIndex = subcategory.trackIndices.find((index) => activeScene.audioTracks[index]);
    const nextVideoIndex = subcategory.videoIndices.find((index) => activeScene.videoLoops[index]);
    if (Number.isInteger(nextTrackIndex) && !subcategory.trackIndices.includes(selectedAudio)) {
      await selectTrack(nextTrackIndex, true);
    }
    if (Number.isInteger(nextVideoIndex) && !subcategory.videoIndices.includes(selectedVideo)) {
      selectVideo(nextVideoIndex);
    }
    trackEvent("sound_subcategory_select", {
      sound_subcategory_id: subcategory.id,
      sound_subcategory_title: subcategory.title,
    });
  }

  async function applyRecipe(recipe) {
    if (Number.isInteger(recipe.sceneIndex) && recipe.sceneIndex >= 0 && recipe.sceneIndex !== activeIndex) {
      await selectScene(recipe.sceneIndex);
    }
    multiSoundEnabled = true;
    selectedAudios = recipe.indices.filter((index) => activeScene.audioTracks[index]);
    selectedAudio = selectedAudios[0];
    selectedAudios.forEach((index, position) => {
      const trackId = getTrackId(index);
      const recipeVolume = Number(recipe.volumes?.[position]);
      if (trackId && (Number.isFinite(recipeVolume) || !Number.isFinite(Number(layerVolumes[trackId])))) {
        layerVolumes = { ...layerVolumes, [trackId]: Number.isFinite(recipeVolume) ? recipeVolume : position === 0 ? 0.74 : 0.62 };
      }
    });
    isVideoPlaying = false;
    savePreferences();
    trackEvent("sound_recipe_apply", {
      recipe_id: recipe.id,
      recipe_title: recipe.title,
      recipe_track_ids: selectedAudios.map((index) => activeScene.audioTracks[index]?.id).filter(Boolean).join(","),
    });
    await playSelectedTracks(selectedAudios, "sound_recipe");
    mixEditorOpen = false;
    if (window.matchMedia("(max-width: 760px)").matches) toggleRecipes();
  }

  async function removeSelectedLayer(index) {
    if (selectedAudios.length <= 1 || !selectedAudios.includes(index)) return;
    const removedTrack = activeScene.audioTracks[index];
    selectedAudios = selectedAudios.filter((trackIndex) => trackIndex !== index);
    selectedAudio = selectedAudios[0];
    if (isAudioPlaying) await playSelectedTracks(selectedAudios, "audio_layer_remove");
    trackEvent("audio_layer_remove", {
      removed_track_id: removedTrack?.id,
      active_sound_count: selectedAudios.length,
    });
    queuePersistSession();
  }

  function selectVideo(index) {
    selectedVideo = index;
    isVideoPlaying = isAudioPlaying && !dataSaverMode;
    trackEvent("video_loop_select", {
      selected_video_id: activeScene.videoLoops[index].id,
      selected_video_title: activeScene.videoLoops[index].title,
    });
    queuePersistSession();
  }

  function setMiniPlayerVolume(nextVolume) {
    volume = Math.max(0, Math.min(1, Number(nextVolume)));
    resumeAudioGraph();
    applyVolume();
    queuePersistSession();
  }

  function updateVolume(event) {
    setMiniPlayerVolume(event.currentTarget.value);
  }

  function commitVolume(event) {
    trackEvent("volume_change", {
      volume_percent: Math.round(Number(event.currentTarget.value) * 100),
      control_source: "main_interface",
    });
  }

  function updateLayerVolume(index, event) {
    const trackId = getTrackId(index);
    if (!trackId) return;
    layerVolumes = { ...layerVolumes, [trackId]: Math.max(0, Math.min(1, Number(event.currentTarget.value))) };
    resumeAudioGraph();
    applyVolume(90);
    queuePersistSession();
  }

  function commitLayerVolume(index) {
    trackEvent("layer_volume_change", {
      selected_track_id: getTrackId(index),
      layer_volume_percent: Math.round(getLayerVolume(index) * 100),
    });
  }

  function updateSmartMixTargets() {
    if (!smartMixEnabled || !isAudioPlaying) return;
    const nextMultipliers = { ...smartMixMultipliers };
    selectedAudios.forEach((index) => {
      const trackId = getTrackId(index);
      if (!trackId) return;
      const minimum = selectedAudios.length > 1 ? 0.72 : 0.9;
      nextMultipliers[trackId] = minimum + Math.random() * (1.04 - minimum);
    });
    smartMixMultipliers = nextMultipliers;
    applyVolume(7600);
  }

  function refreshSmartMixSchedule() {
    window.clearInterval(smartMixTimer);
    smartMixTimer = undefined;
    if (!smartMixEnabled || !isAudioPlaying) return;
    smartMixTimer = window.setInterval(updateSmartMixTargets, smartMixIntervalMilliseconds);
  }

  function setSmartMixEnabled(enabled) {
    smartMixEnabled = enabled;
    if (enabled) {
      updateSmartMixTargets();
      showToast("Smart Mix is gently evolving each active layer");
    } else {
      smartMixMultipliers = {};
      applyVolume(700);
      showToast("Smart Mix is off");
    }
    refreshSmartMixSchedule();
    savePreferences();
    queuePersistSession();
    trackEvent("smart_mix_preference", { enabled, active_sound_count: selectedAudios.length });
  }

  function setDataSaverMode(enabled) {
    dataSaverMode = enabled;
    isVideoPlaying = isAudioPlaying && !enabled;
    backgroundComponent?.setAutoPictureInPicture(!enabled && isAudioPlaying && pipPreference === "automatic");
    savePreferences();
    queuePersistSession();
    miniPlayerController?.sync(getMiniPlayerState());
    showToast(enabled ? "Audio-only mode on · video data paused" : "Video backgrounds restored");
    trackEvent("data_saver_preference", { enabled });
  }

  function showToast(message) {
    toastMessage = message;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastMessage = ""), 3600);
  }

  function createCurrentMixSnapshot(overrides = {}) {
    return normalizeMixSnapshot({
      sceneId: activeScene.id,
      trackIds: selectedAudios.map((index) => getTrackId(index)).filter(Boolean),
      layerVolumes,
      videoId: activeVideo.id,
      masterVolume: volume,
      smartMixEnabled,
      multiSoundEnabled,
      linkedPlayback,
      dataSaverMode,
      ...overrides,
    }, scenes);
  }

  function getMixScene(mix) {
    return scenes.find((scene) => scene.id === mix.sceneId) || scenes[0];
  }

  function getMixTrackNames(mix) {
    const scene = getMixScene(mix);
    return mix.trackIds.map((trackId) => scene.audioTracks.find((track) => track.id === trackId)?.title).filter(Boolean);
  }

  function getMixDescription(mix) {
    const names = getMixTrackNames(mix);
    return `${getMixScene(mix).title} · ${names.join(" + ") || "Ambient mix"}`;
  }

  function persistSavedMixes() {
    localStorage.setItem(savedMixesStorageKey, JSON.stringify(savedMixes));
  }

  function persistRecentMixes() {
    localStorage.setItem(recentMixesStorageKey, JSON.stringify(recentMixes));
  }

  function queuePersistSession() {
    if (!hydrated) return;
    window.clearTimeout(persistenceTimer);
    persistenceTimer = window.setTimeout(() => {
      localStorage.setItem(resumeStorageKey, JSON.stringify(createCurrentMixSnapshot()));
    }, 180);
  }

  function recordRecentSession(source = "interface") {
    if (!hydrated) return;
    recentMixes = upsertRecentMix(recentMixes, createCurrentMixSnapshot(), scenes);
    persistRecentMixes();
    trackEvent("recent_session_record", { history_source: source, recent_count: recentMixes.length });
  }

  function openSaveMix() {
    saveMixName = `${activeScene.title} mix`;
    saveMixOpen = true;
  }

  function closeSaveMix() {
    saveMixOpen = false;
    saveMixName = "";
  }

  function saveCurrentMix() {
    const name = saveMixName.trim().slice(0, 64) || `${activeScene.title} mix`;
    const id = globalThis.crypto?.randomUUID?.() || `mix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const snapshot = createCurrentMixSnapshot({ id, name, savedAt: Date.now(), favorite: false });
    savedMixes = sortSavedMixes([snapshot, ...savedMixes], scenes);
    persistSavedMixes();
    closeSaveMix();
    showToast(`Saved “${name}”`);
    trackEvent("mix_save", { saved_mix_count: savedMixes.length, active_sound_count: selectedAudios.length });
  }

  function toggleSavedMixFavorite(mixId) {
    savedMixes = sortSavedMixes(savedMixes.map((mix) => mix.id === mixId ? { ...mix, favorite: !mix.favorite } : mix), scenes);
    persistSavedMixes();
    const updatedMix = savedMixes.find((mix) => mix.id === mixId);
    showToast(updatedMix?.favorite ? "Added to favorite mixes" : "Removed from favorite mixes");
    trackEvent("mix_favorite", { favorite: Boolean(updatedMix?.favorite), favorite_mix_count: savedMixes.filter((mix) => mix.favorite).length });
  }

  function deleteSavedMix(mixId) {
    const deleted = savedMixes.find((mix) => mix.id === mixId);
    savedMixes = savedMixes.filter((mix) => mix.id !== mixId);
    persistSavedMixes();
    showToast(deleted ? `Removed “${deleted.name}”` : "Mix removed");
    trackEvent("mix_delete", { saved_mix_count: savedMixes.length });
  }

  function toggleCurrentSceneFavorite() {
    const nextFavorite = !currentSceneFavorite;
    favoriteSceneIds = currentSceneFavorite
      ? favoriteSceneIds.filter((sceneId) => sceneId !== activeScene.id)
      : [...favoriteSceneIds, activeScene.id];
    localStorage.setItem(favoriteScenesStorageKey, JSON.stringify(favoriteSceneIds));
    showToast(nextFavorite ? `${activeScene.title} added to favorites` : `${activeScene.title} removed from favorites`);
    trackEvent("scene_favorite", { favorite: nextFavorite, favorite_scene_count: favoriteSceneIds.length });
  }

  async function applyMixSnapshot(value, source = "saved_mix") {
    const snapshot = normalizeMixSnapshot(value, scenes);
    if (!snapshot) {
      showToast("This mix could not be loaded");
      return;
    }
    const continuePlaying = isAudioPlaying;
    if (continuePlaying) await fadeAndPauseAllAudio(audioCrossfadeMilliseconds / 2);
    else pauseAllAudio();

    const sceneIndex = scenes.findIndex((scene) => scene.id === snapshot.sceneId);
    activeIndex = Math.max(0, sceneIndex);
    await tick();
    selectedAudios = snapshot.trackIds
      .map((trackId) => activeScene.audioTracks.findIndex((track) => track.id === trackId))
      .filter((index) => index >= 0);
    if (!selectedAudios.length) selectedAudios = [0];
    selectedAudio = selectedAudios[0];
    selectedVideo = Math.max(0, activeScene.videoLoops.findIndex((loop) => loop.id === snapshot.videoId));
    layerVolumes = { ...layerVolumes, ...snapshot.layerVolumes };
    volume = snapshot.masterVolume;
    smartMixEnabled = snapshot.smartMixEnabled;
    multiSoundEnabled = snapshot.multiSoundEnabled || selectedAudios.length > 1;
    linkedPlayback = snapshot.linkedPlayback;
    dataSaverMode = snapshot.dataSaverMode;
    isVideoPlaying = false;
    smartMixMultipliers = {};
    applyVolume(0);
    savePreferences();
    queuePersistSession();
    refreshSmartMixSchedule();
    if (continuePlaying) await playSelectedTracks(selectedAudios, source);
    const sourceLabel = source === "shared_mix" ? "Shared mix" : source === "recent_mix" ? "Recent session" : source === "resume" ? "Last session" : "Saved mix";
    showToast(`${sourceLabel} loaded · press play when ready`);
    mixEditorOpen = false;
    if (recipesOpen && window.matchMedia("(max-width: 760px)").matches) toggleRecipes();
    if (source === "resume") trackEvent("history_resume", { active_sound_count: selectedAudios.length });
    trackEvent("mix_load", { mix_source: source, active_sound_count: selectedAudios.length });
  }

  async function shareMix(value = createCurrentMixSnapshot()) {
    const snapshot = normalizeMixSnapshot(value, scenes);
    const encoded = encodeMixSnapshot(snapshot, scenes);
    if (!encoded) return;
    const shareUrl = new URL(window.location.href);
    shareUrl.search = "";
    shareUrl.hash = "";
    shareUrl.searchParams.set("mix", encoded);
    const shareData = {
      title: `${getMixScene(snapshot).title} · Atmosphere`,
      text: `Listen to this ${getMixScene(snapshot).title.toLowerCase()} atmosphere mix.`,
      url: shareUrl.toString(),
    };
    let sharedWithSystem = false;
    if (navigator.share && window.matchMedia("(max-width: 900px)").matches) {
      try {
        await navigator.share(shareData);
        sharedWithSystem = true;
        showToast("Mix shared");
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    if (!sharedWithSystem) {
      try {
        await navigator.clipboard.writeText(shareData.url);
      } catch (error) {
        const textArea = document.createElement("textarea");
        textArea.value = shareData.url;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      showToast("Share link copied");
    }
    trackEvent("mix_share", { share_method: sharedWithSystem ? "system" : "clipboard", active_sound_count: selectedAudios.length });
  }

  function setLibraryCategory(category) {
    libraryCategory = category;
    trackEvent("scene_filter", {
      scene_category_filter: category,
      result_count: filterSceneLibrary(scenes, libraryQuery, category, favoriteSceneIds).length,
    });
  }

  function commitLibrarySearch() {
    trackEvent("scene_search", { search_length: libraryQuery.trim().length, result_count: filteredScenes.length });
  }

  function formatCategory(category) {
    if (category === "all") return "All";
    if (category === "favorites") return "Favorites";
    return `${category.charAt(0).toUpperCase()}${category.slice(1)}`;
  }

  function clearRecentMixes() {
    recentMixes = [];
    persistRecentMixes();
    showToast("Recent sessions cleared");
    trackEvent("recent_sessions_clear");
  }

  function savePreferences() {
    localStorage.setItem(preferencesStorageKey, JSON.stringify({
      linkedPlayback,
      multiSoundEnabled,
      smartMixEnabled,
      dataSaverMode,
      volume,
      weatherMode,
      weatherSoundStrength,
      weatherAutoMatch,
      weatherFollowTime,
    }));
  }

  async function setMultiSoundEnabled(enabled) {
    multiSoundEnabled = enabled;
    if (!enabled && selectedAudios.length > 1) {
      const keepIndex = selectedAudios.includes(selectedAudio) ? selectedAudio : selectedAudios[0];
      selectedAudio = keepIndex;
      selectedAudios = [keepIndex];
      if (isAudioPlaying) await playSelectedTracks();
      else audioElements.forEach((element, index) => {
        if (index !== keepIndex) element?.pause();
      });
    }
    savePreferences();
    queuePersistSession();
    refreshSmartMixSchedule();
    trackEvent("multi_sound_preference", { enabled, active_sound_count: selectedAudios.length });
  }

  function setLinkedPlayback(enabled) {
    linkedPlayback = enabled;
    if (enabled && isAudioPlaying) isVideoPlaying = !dataSaverMode;
    savePreferences();
    queuePersistSession();
    trackEvent("linked_playback_preference", { enabled });
  }

  function lockSettingsPageScroll() {
    if (settingsPageLocked || typeof window === "undefined") return;
    settingsPageScrollY = window.scrollY;
    settingsBodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };
    Object.assign(document.body.style, {
      position: "fixed",
      top: `-${settingsPageScrollY}px`,
      left: "0",
      right: "0",
      width: "100%",
      overflow: "hidden",
    });
    document.documentElement.classList.add("settings-scroll-locked");
    settingsPageLocked = true;
  }

  function unlockSettingsPageScroll() {
    if (!settingsPageLocked || typeof window === "undefined") return;
    Object.assign(document.body.style, settingsBodyStyles);
    document.documentElement.classList.remove("settings-scroll-locked");
    settingsPageLocked = false;
    window.scrollTo(0, settingsPageScrollY);
  }

  function openSettings(tab = "playback") {
    settingsTab = tab;
    lockSettingsPageScroll();
    settingsOpen = true;
    trackEvent("settings_open", { settings_tab: tab });
  }

  function closeSettings() {
    settingsOpen = false;
    unlockSettingsPageScroll();
    trackEvent("settings_close", { settings_tab: settingsTab });
  }

  function selectSettingsTab(tab) {
    settingsTab = tab;
    trackEvent("settings_tab_view", { settings_tab: tab });
  }

  function toggleVideoPlayback() {
    if (dataSaverMode) {
      showToast("Turn off Audio only to restore video");
      return;
    }
    if (!isAudioPlaying) {
      isVideoPlaying = false;
      showToast("Start the sound before playing background motion");
      return;
    }
    isVideoPlaying = !isVideoPlaying;
    trackEvent(isVideoPlaying ? "video_play" : "video_pause", { control_source: "separate_video_control" });
  }

  function handleSettingsBackdrop(event) {
    if (event.target === event.currentTarget) closeSettings();
  }

  function enterImmersiveMode() {
    settingsOpen = false;
    unlockSettingsPageScroll();
    immersiveMode = true;
    trackEvent("quiet_view_enter", { audio_playing: isAudioPlaying });
  }

  function exitImmersiveMode() {
    immersiveMode = false;
    trackEvent("quiet_view_exit", { audio_playing: isAudioPlaying });
  }

  function toggleRecipes() {
    recipesOpen = !recipesOpen;
    localStorage.setItem("atmosphere-recipes-open-v3", String(recipesOpen));
    trackEvent(recipesOpen ? "sound_recipes_open" : "sound_recipes_close");
  }

  function togglePlayerDetails() {
    playerDetailsOpen = !playerDetailsOpen;
    if (!playerDetailsOpen) mixEditorOpen = false;
    trackEvent("player_details_toggle", { expanded: playerDetailsOpen });
  }

  function toggleLibraryTools() {
    libraryToolsOpen = !libraryToolsOpen;
    trackEvent("library_tools_toggle", { expanded: libraryToolsOpen });
  }

  function selectMixDrawerTab(tab) {
    mixDrawerTab = tab;
    trackEvent("mix_drawer_tab", { mix_drawer_tab: tab });
  }

  function selectMixIntent(intent) {
    mixIntent = intent;
    trackEvent("mix_intent_filter", { mix_intent: intent });
  }

  function handleKeydown(event) {
    if (event.key !== "Escape") return;
    if (saveMixOpen) closeSaveMix();
    else if (settingsOpen) closeSettings();
    else if (immersiveMode) exitImmersiveMode();
  }

  function handleLogoClick(event) {
    if (!immersiveMode) return;
    event.preventDefault();
    exitImmersiveMode();
  }

  function getMiniPlayerState() {
    return {
      ...miniPlayerSnapshot,
      video: dataSaverMode ? undefined : backgroundComponent?.getVideoElement(),
    };
  }

  async function toggleMiniPlayer() {
    if (!miniPlayerController) return;
    if (pipPreference === "off") {
      miniPlayerStatus = "Mini player is off. Choose Automatic or Manual only to enable it.";
      openSettings("mini-player");
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
    localStorage.setItem("atmosphere-pip-preference", nextPreference);
    trackEvent("mini_player_preference", { mini_player_preference: nextPreference });
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

  function readStoredJson(key, fallback) {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : fallback;
    } catch (error) {
      localStorage.removeItem(key);
      return fallback;
    }
  }

  onMount(() => {
    pipControlsAvailable = !isAppleMobileDevice();
    const savedPreferences = readStoredJson(
      preferencesStorageKey,
      readStoredJson(legacyPreferencesStorageKey, {}),
    );
    if (typeof savedPreferences.linkedPlayback === "boolean") linkedPlayback = savedPreferences.linkedPlayback;
    if (typeof savedPreferences.multiSoundEnabled === "boolean") multiSoundEnabled = savedPreferences.multiSoundEnabled;
    if (typeof savedPreferences.smartMixEnabled === "boolean") smartMixEnabled = savedPreferences.smartMixEnabled;
    if (typeof savedPreferences.dataSaverMode === "boolean") dataSaverMode = savedPreferences.dataSaverMode;
    if (Number.isFinite(Number(savedPreferences.volume))) volume = Math.max(0, Math.min(1, Number(savedPreferences.volume)));
    if (["match", "comfort"].includes(savedPreferences.weatherMode)) weatherMode = savedPreferences.weatherMode;
    if (["subtle", "realistic", "immersive"].includes(savedPreferences.weatherSoundStrength)) weatherSoundStrength = savedPreferences.weatherSoundStrength;
    if (typeof savedPreferences.weatherAutoMatch === "boolean") weatherAutoMatch = savedPreferences.weatherAutoMatch;
    if (typeof savedPreferences.weatherFollowTime === "boolean") weatherFollowTime = savedPreferences.weatherFollowTime;
    savedMixes = sortSavedMixes(readStoredJson(savedMixesStorageKey, []), scenes);
    recentMixes = readStoredJson(recentMixesStorageKey, [])
      .map((mix) => normalizeMixSnapshot(mix, scenes))
      .filter(Boolean)
      .slice(0, 6);
    favoriteSceneIds = readStoredJson(favoriteScenesStorageKey, [])
      .filter((sceneId) => scenes.some((scene) => scene.id === sceneId));
    const firstTrackId = getTrackId(0);
    if (firstTrackId) layerVolumes = { [firstTrackId]: 1 };
    const savedRecipesOpen = localStorage.getItem("atmosphere-recipes-open-v3");
    recipesOpen = savedRecipesOpen === "true";
    initializeAnalytics(getAnalyticsContext);
    const analyticsStatus = getAnalyticsStatus();
    analyticsConfigured = analyticsStatus.configured;
    analyticsConsent = analyticsStatus.consent;
    trackEvent("atmosphere_view", { view_source: "initial_load" });
    if (pipControlsAvailable) {
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
          trackEvent(open ? "mini_player_open" : "mini_player_close", { mini_player_mode: mode || "unknown" });
        },
      });
      miniPlayerController.sync(getMiniPlayerState());
    } else {
      pipPreference = "off";
      pipPromptVisible = false;
    }
    initializeDesktopRuntime({
      togglePlayback: () => togglePlayback("desktop_tray"),
    }).then((cleanup) => {
      desktopRuntimeCleanup = cleanup;
    });
    hydrated = true;

    const sharedMix = decodeMixSnapshot(new URL(window.location.href).searchParams.get("mix"), scenes);
    const resumeMix = normalizeMixSnapshot(readStoredJson(resumeStorageKey, null), scenes);
    if (sharedMix) {
      applyMixSnapshot(sharedMix, "shared_mix");
    } else if (resumeMix) {
      applyMixSnapshot(resumeMix, "resume");
    } else {
      dataSaverMode = Boolean(savedPreferences.dataSaverMode);
      isVideoPlaying = false;
      queuePersistSession();
    }
  });

  onDestroy(() => {
    cancelAnimationFrame(analyserFrame);
    window.clearInterval(smartMixTimer);
    window.clearTimeout(toastTimer);
    window.clearTimeout(persistenceTimer);
    mediaSources.forEach((source) => source.disconnect());
    layerGainNodes.forEach((gainNode) => gainNode?.disconnect());
    masterGainNode?.disconnect();
    limiterNode?.disconnect();
    analyserNode?.disconnect();
    audioContext?.close();
    destroyAnalytics();
    miniPlayerController?.destroy();
    desktopRuntimeCleanup?.();
    unlockSettingsPageScroll();
  });
</script>

<svelte:window on:keydown={handleKeydown} />

<div class:immersive={immersiveMode} class="app-shell" style={`--accent: ${activeScene.accent}; --accent-rgb: ${activeScene.accentRgb}`}>
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
    disabled={dataSaverMode}
  />
  {#each activeScene.audioTracks as track, index (index)}
    <audio
      bind:this={audioElements[index]}
      src={track.src}
      crossorigin="anonymous"
      preload={selectedAudios.includes(index) ? "metadata" : "none"}
      loop
      on:play={syncAudioPlaybackState}
      on:pause={() => requestAnimationFrame(syncAudioPlaybackState)}
      on:canplay={() => (audioLoading = false)}
      on:error={() => handleAudioError(track)}
    ></audio>
  {/each}

  <header class:immersive={immersiveMode} class="topbar">
    <a class="wordmark" href={homeHref} aria-label={immersiveMode ? "Exit quiet view" : "Atmosphere home"} title={immersiveMode ? "Exit quiet view" : undefined} on:click={handleLogoClick}>
      <img class="brand-icon" src={faviconHref} width="30" height="30" alt="" aria-hidden="true" decoding="async" />
      <span class="wordmark-copy"><span>ATMO</span><i></i><span>SPHERE</span></span>
    </a>
    <AmbientStatus
      bind:this={ambientStatusComponent}
      immersive={immersiveMode}
      on:notice={(event) => showToast(event.detail)}
      on:weatherstate={handleWeatherState}
      on:weather={handleWeatherUpdate}
    />
    {#if !immersiveMode}
      <div class="topbar-actions">
      {#if pipControlsAvailable}
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
      </div>
      {/if}
      {#if !linkedPlayback && !dataSaverMode}
        <button
          class="video-toggle glass-button"
          type="button"
          aria-label={isVideoPlaying ? "Pause background video" : "Play background video"}
          on:click={toggleVideoPlayback}
        >
          {#if isVideoPlaying}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6.5v11M15.5 6.5v11" /></svg>
            <span>Pause motion</span>
          {:else}
            <svg class="play-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" /></svg>
            <span>Play motion</span>
          {/if}
        </button>
      {/if}
      <button class="settings-button glass-button" type="button" aria-label="Open settings and preferences" on:click={() => openSettings()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z" /><path d="M19.2 13.6a7.7 7.7 0 0 0 0-3.2l2-1.5-2-3.4-2.5 1a8.6 8.6 0 0 0-2.7-1.6L13.6 2H10.4L10 4.9a8.6 8.6 0 0 0-2.7 1.6l-2.5-1-2 3.4 2 1.5a7.7 7.7 0 0 0 0 3.2l-2 1.5 2 3.4 2.5-1a8.6 8.6 0 0 0 2.7 1.6l.4 2.9h3.2l.4-2.9a8.6 8.6 0 0 0 2.7-1.6l2.5 1 2-3.4-2-1.5Z" /></svg>
        <span>Settings</span>
      </button>
      </div>
    {/if}
    <p class="sr-only" aria-live="polite">{miniPlayerStatus}</p>
  </header>

  {#if !immersiveMode}
    <button class="quiet-view-button" type="button" aria-label="Enter quiet view" title="Enter quiet view" on:click={enterImmersiveMode}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 4H6a2 2 0 0 0-2 2v3M15 4h3a2 2 0 0 1 2 2v3M9 20H6a2 2 0 0 1-2-2v-3M15 20h3a2 2 0 0 0 2-2v-3" />
        <path class="quiet-wave" d="M8.5 13.5v-3M12 15.5v-7M15.5 13.5v-3" />
      </svg>
    </button>
  {/if}

  {#if pipControlsAvailable && pipPromptVisible && !immersiveMode && (!analyticsConfigured || analyticsConsent !== "unset")}
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

  {#if analyticsConfigured && analyticsConsent === "unset" && !immersiveMode}
    <section class="analytics-consent" role="dialog" aria-labelledby="analytics-consent-title" aria-describedby="analytics-consent-copy">
      <span class="analytics-consent-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M5 18v-5M10 18V8M15 18v-3M20 18V5" /></svg>
      </span>
      <div>
        <p class="kicker">Privacy choice</p>
        <h2 id="analytics-consent-title">Help improve Atmosphere?</h2>
        <p id="analytics-consent-copy">Share anonymous listening and feature-use data. Analytics never receives weather coordinates, personal details, or advertising profiles.</p>
      </div>
      <div class="analytics-consent-actions">
        <button class="analytics-allow" type="button" on:click={() => updateAnalyticsPreference("granted")}>Allow analytics</button>
        <button type="button" on:click={() => updateAnalyticsPreference("denied")}>Not now</button>
        <button type="button" on:click={() => openSettings("privacy")}>Details</button>
      </div>
    </section>
  {/if}

  {#if toastMessage}
    <div class="app-toast" role="status" aria-live="polite">
      <span aria-hidden="true"></span>
      {toastMessage}
    </div>
  {/if}

  {#if saveMixOpen && !immersiveMode}
    <div class="save-mix-backdrop" role="presentation" on:click={(event) => { if (event.target === event.currentTarget) closeSaveMix(); }}>
      <form class="save-mix-dialog" aria-labelledby="save-mix-title" on:submit|preventDefault={saveCurrentMix}>
        <div>
          <p class="kicker">Personal library</p>
          <h2 id="save-mix-title">Save this mix</h2>
          <p>{getMixDescription(createCurrentMixSnapshot())}</p>
        </div>
        <label>
          <span>Mix name</span>
          <input bind:value={saveMixName} maxlength="64" autocomplete="off" placeholder="My atmosphere" />
        </label>
        <div class="save-mix-actions">
          <button type="button" on:click={closeSaveMix}>Cancel</button>
          <button class="primary" type="submit">Save mix</button>
        </div>
      </form>
    </div>
  {/if}

  {#if settingsOpen && !immersiveMode}
    <div class="settings-backdrop" role="presentation" on:click={handleSettingsBackdrop} on:keydown={(event) => { if (event.key === "Escape") closeSettings(); }}>
      <section class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header class="settings-header">
          <div>
            <p class="kicker">Preferences</p>
            <h2 id="settings-title">Make the room yours</h2>
          </div>
          <button class="settings-close" type="button" aria-label="Close settings" on:click={closeSettings}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5 16.5 16.5M16.5 7.5 7.5 16.5" /></svg>
          </button>
        </header>

        <div class="settings-layout">
          <nav class="settings-tabs" aria-label="Settings sections">
            {#each visibleSettingsTabs as tab}
              <button class:active={settingsTab === tab.id} type="button" aria-current={settingsTab === tab.id ? "page" : undefined} on:click={() => selectSettingsTab(tab.id)}>
                <span>{tab.title}</span><i aria-hidden="true"></i>
              </button>
            {/each}
          </nav>

          <div class="settings-content">
            {#if settingsTab === "playback"}
              <div class="settings-pane" aria-labelledby="playback-settings-heading">
                <div class="settings-pane-heading">
                  <h3 id="playback-settings-heading">Playback</h3>
                  <p>Choose how the room moves and how many sounds it can hold.</p>
                </div>
                <button class="preference-row" type="button" aria-pressed={linkedPlayback} on:click={() => setLinkedPlayback(!linkedPlayback)}>
                  <span><strong>Unified playback</strong><small>Play sound and motion together. Pausing sound always pauses the video.</small></span>
                  <i class:active={linkedPlayback} class="preference-switch" aria-hidden="true"><b></b></i>
                </button>
                <button class="preference-row" type="button" aria-pressed={multiSoundEnabled} on:click={() => setMultiSoundEnabled(!multiSoundEnabled)}>
                  <span><strong>Layer multiple sounds</strong><small>Select more than one audio card or start a recommended mix.</small></span>
                  <i class:active={multiSoundEnabled} class="preference-switch" aria-hidden="true"><b></b></i>
                </button>
                <button class="preference-row" type="button" aria-pressed={smartMixEnabled} on:click={() => setSmartMixEnabled(!smartMixEnabled)}>
                  <span><strong>Smart Mix</strong><small>Let active layers slowly rise and settle so the soundscape feels less repetitive.</small></span>
                  <i class:active={smartMixEnabled} class="preference-switch" aria-hidden="true"><b></b></i>
                </button>
                <label class="volume-row settings-volume">
                  <span>Master volume</span>
                  <input type="range" min="0" max="1" step="0.01" value={volume} style={`--volume-percent: ${Math.round(volume * 100)}%`} aria-label="Master audio volume" aria-valuetext={`${Math.round(volume * 100)} percent`} on:input={updateVolume} on:change={commitVolume} />
                  <output>{Math.round(volume * 100)}</output>
                </label>
                <div class="settings-note compact-note">
                  <span class="settings-note-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M4 12h4l2.2-5 3.5 10 2.2-5H20" /></svg>
                  </span>
                  <span><strong>Smooth transitions are always on</strong><small>Sounds and videos crossfade when you change a track, mix, or atmosphere.</small></span>
                </div>
              </div>
            {:else if settingsTab === "mixes"}
              <div class="settings-pane" aria-labelledby="mixes-settings-heading">
                <div class="settings-pane-heading">
                  <h3 id="mixes-settings-heading">My mixes</h3>
                  <p>Saved mixes stay in this browser. Share links contain only playback choices—never your custom mix name.</p>
                </div>
                {#if savedMixes.length}
                  <div class="settings-mix-list">
                    {#each savedMixes as mix (mix.id)}
                      <article class="settings-mix-card">
                        <button class="settings-mix-load" type="button" on:click={() => { applyMixSnapshot(mix); closeSettings(); }}>
                          <span><strong>{mix.name || getMixScene(mix).title}</strong><small>{getMixDescription(mix)}</small></span>
                        </button>
                        <div>
                          <button class:active={mix.favorite} type="button" aria-label={mix.favorite ? "Remove from favorite mixes" : "Add to favorite mixes"} title={mix.favorite ? "Unfavorite" : "Favorite"} on:click={() => toggleSavedMixFavorite(mix.id)}>★</button>
                          <button type="button" aria-label={`Share ${mix.name || "mix"}`} title="Share mix" on:click={() => shareMix(mix)}>↗</button>
                          <button type="button" aria-label={`Delete ${mix.name || "mix"}`} title="Delete mix" on:click={() => deleteSavedMix(mix.id)}>×</button>
                        </div>
                      </article>
                    {/each}
                  </div>
                {:else}
                  <div class="empty-library-state"><strong>No saved mixes yet</strong><span>Use Save mix beside the main player after arranging your layers.</span></div>
                {/if}
                {#if recentMixes.length}
                  <div class="recent-settings-heading"><strong>Recently played</strong><button type="button" on:click={clearRecentMixes}>Clear</button></div>
                  <div class="recent-settings-list">
                    {#each recentMixes as mix}
                      <button type="button" on:click={() => { applyMixSnapshot(mix, "recent_mix"); closeSettings(); }}>
                        <strong>{getMixScene(mix).title}</strong><span>{getMixTrackNames(mix).join(" + ")}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {:else if settingsTab === "weather"}
              <div class="settings-pane" aria-labelledby="weather-settings-heading">
                <div class="settings-pane-heading">
                  <h3 id="weather-settings-heading">Live weather</h3>
                  <p>Let the current conditions choose a verified atmosphere and balance its sound layers.</p>
                </div>
                <div class="preference-choice-list weather-mode-choices">
                  <button class:active={weatherMode === "match"} type="button" aria-pressed={weatherMode === "match"} on:click={() => setWeatherMode("match")}>
                    <i aria-hidden="true"></i>
                    <span><strong>Mirror outside</strong><small>Match rain, wind, cloud, snow, temperature, and local daylight.</small></span>
                  </button>
                  <button class:active={weatherMode === "comfort"} type="button" aria-pressed={weatherMode === "comfort"} on:click={() => setWeatherMode("comfort")}>
                    <i aria-hidden="true"></i>
                    <span><strong>Comforting contrast</strong><small>Choose a sheltered or cooling atmosphere for the weather outside.</small></span>
                  </button>
                </div>
                <div class="weather-strength-control" aria-labelledby="weather-strength-label">
                  <span id="weather-strength-label">Weather sound strength</span>
                  <div>
                    {#each ["subtle", "realistic", "immersive"] as strength}
                      <button class:active={weatherSoundStrength === strength} type="button" aria-pressed={weatherSoundStrength === strength} on:click={() => setWeatherSoundStrength(strength)}>{formatCategory(strength)}</button>
                    {/each}
                  </div>
                </div>
                <button class="preference-row" type="button" aria-pressed={weatherAutoMatch} on:click={() => setWeatherAutoMatch(!weatherAutoMatch)}>
                  <span><strong>Keep the match current</strong><small>Refresh the active weather atmosphere when conditions update.</small></span>
                  <i class:active={weatherAutoMatch} class="preference-switch" aria-hidden="true"><b></b></i>
                </button>
                <button class="preference-row" type="button" aria-pressed={weatherFollowTime} on:click={() => setWeatherFollowTime(!weatherFollowTime)}>
                  <span><strong>Follow local daylight</strong><small>Use daytime or nighttime footage based on the selected location.</small></span>
                  <i class:active={weatherFollowTime} class="preference-switch" aria-hidden="true"><b></b></i>
                </button>
                <form class="weather-city-form" on:submit|preventDefault={requestCityWeather}>
                  <label for="weather-city-input">Use another city</label>
                  <div>
                    <input id="weather-city-input" bind:value={weatherCityQuery} type="search" minlength="2" autocomplete="address-level2" placeholder="City or region" />
                    <button type="submit" disabled={weatherCityBusy || weatherCityQuery.trim().length < 2}>{weatherCityBusy ? "Finding…" : "Match"}</button>
                  </div>
                  <small>The search term and rounded coordinates go only to Open‑Meteo and are not saved.</small>
                </form>
                <button class="settings-action secondary" type="button" on:click={requestLiveWeather}>Use this device’s location</button>
              </div>
            {:else if settingsTab === "display"}
              <div class="settings-pane" aria-labelledby="display-settings-heading">
                <div class="settings-pane-heading">
                  <h3 id="display-settings-heading">Display</h3>
                  <p>Step away from controls and let the atmosphere fill the screen.</p>
                </div>
                <div class="quiet-view-preview" aria-hidden="true">
                  <span class="preview-logo"><img src={faviconHref} alt="" /></span>
                  <div class="preview-visualizer">{#each visualLevels as level}<i style={`height: ${Math.max(4, level / 2)}px`}></i>{/each}</div>
                </div>
                <div class="settings-note">
                  <span class="settings-note-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="M9 4H6a2 2 0 0 0-2 2v3M15 4h3a2 2 0 0 1 2 2v3M9 20H6a2 2 0 0 1-2-2v-3M15 20h3a2 2 0 0 0 2-2v-3" /><path d="M8.5 13.5v-3M12 15.5v-7M15.5 13.5v-3" /></svg>
                  </span>
                  <span><strong>Quiet view lives in the lower corner</strong><small>Use the focus icon anytime. Select the logo or press Escape to return.</small></span>
                </div>
                <button class="preference-row" type="button" aria-pressed={dataSaverMode} on:click={() => setDataSaverMode(!dataSaverMode)}>
                  <span><strong>Audio only / Data Saver</strong><small>Stop all video downloads and use the atmosphere poster with subtle motion.</small></span>
                  <i class:active={dataSaverMode} class="preference-switch" aria-hidden="true"><b></b></i>
                </button>
              </div>
            {:else if settingsTab === "mini-player" && pipControlsAvailable}
              <div class="settings-pane" aria-labelledby="mini-settings-heading">
                <div class="settings-pane-heading">
                  <h3 id="mini-settings-heading">Mini player</h3>
                  <p>Decide when Atmosphere can stay nearby outside this tab.</p>
                </div>
                <div class="preference-choice-list">
                  {#each pipPreferences as preference}
                    <button class:active={pipPreference === preference.id} type="button" aria-pressed={pipPreference === preference.id} on:click={() => choosePipPreference(preference.id)}>
                      <i aria-hidden="true"></i>
                      <span><strong>{preference.title}</strong><small>{preference.detail}</small></span>
                    </button>
                  {/each}
                </div>
                <button class="settings-action secondary" type="button" disabled={pipPreference === "off"} on:click={toggleMiniPlayer}>{miniPlayerOpen ? "Close mini player" : "Open mini player now"}</button>
              </div>
            {:else if settingsTab === "privacy"}
              <div class="settings-pane" aria-labelledby="privacy-settings-heading">
                <div class="settings-pane-heading privacy-heading">
                  <div>
                    <h3 id="privacy-settings-heading">Privacy & analytics</h3>
                    <p>Control anonymous usage measurement for this browser.</p>
                  </div>
                  <span class:active={analyticsConfigured} class="analytics-status">{analyticsConfigured ? "GA4 ready" : "ID required"}</span>
                </div>
                <div class="preference-choice-list analytics-choices">
                  <button class:active={analyticsConsent === "granted"} type="button" aria-pressed={analyticsConsent === "granted"} on:click={() => updateAnalyticsPreference("granted")}>
                    <i aria-hidden="true"></i>
                    <span><strong>Allow anonymous analytics</strong><small>Measure listening time, feature use, performance, approximate region, and engagement milestones.</small></span>
                  </button>
                  <button class:active={analyticsConsent === "denied"} type="button" aria-pressed={analyticsConsent === "denied"} on:click={() => updateAnalyticsPreference("denied")}>
                    <i aria-hidden="true"></i>
                    <span><strong>Do not measure my usage</strong><small>Analytics storage and all custom Atmosphere events stay disabled on this browser.</small></span>
                  </button>
                </div>
                <div class="privacy-summary">
                  <strong>Weather location stays separate</strong>
                  <p>Analytics never requests GPS. If you choose Add local weather, your browser asks permission, Atmosphere rounds the coordinates to roughly one kilometre, and sends them only to Open-Meteo. Coordinates stay in memory, are never stored by Atmosphere, and are never attached to GA4 events.</p>
                  <span>Open-Meteo may retain API logs for up to 90 days. Advertising storage, Google Signals, and ad personalization remain disabled.</span>
                </div>
                <a class="settings-action secondary" href={privacyHref} target="_blank" rel="noreferrer">Read the full privacy policy</a>
                {#if !analyticsConfigured}
                  <div class="analytics-setup-note">
                    <strong>Finish setup with one value</strong>
                    <p>Create a GA4 web stream, then replace <code>G-XXXXXXXXXX</code> in the <code>google-analytics-id</code> meta tag. No application code needs to change.</p>
                  </div>
                {/if}
              </div>
            {:else}
              <div class="settings-pane" aria-labelledby="about-settings-heading">
                <div class="settings-pane-heading">
                  <h3 id="about-settings-heading">About Atmosphere</h3>
                  <p>Slow video and carefully matched field recordings for focus, rest, and calm.</p>
                </div>
                <div class="credits-card">
                  <span>Desktop &amp; policies</span>
                  <a href={installHref} target="_blank" rel="noreferrer">Download desktop app <b aria-hidden="true">↗</b></a>
                  <a href={privacyHref} target="_blank" rel="noreferrer">Privacy policy <b aria-hidden="true">↗</b></a>
                  <a href={termsHref} target="_blank" rel="noreferrer">Terms of use <b aria-hidden="true">↗</b></a>
                  <a href={securityHref} target="_blank" rel="noreferrer">Security <b aria-hidden="true">↗</b></a>
                  <a href={accessibilityHref} target="_blank" rel="noreferrer">Accessibility <b aria-hidden="true">↗</b></a>
                  <a href={licensesHref} target="_blank" rel="noreferrer">Licenses &amp; third-party notices <b aria-hidden="true">↗</b></a>
                </div>
                <div class="credits-card">
                  <span>Media &amp; data attribution</span>
                  <a href={creditsHref} target="_blank" rel="noreferrer">Audio credits <b aria-hidden="true">↗</b></a>
                  <a href={videoCreditsHref} target="_blank" rel="noreferrer">Video credits <b aria-hidden="true">↗</b></a>
                  <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo <b aria-hidden="true">↗</b></a>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </section>
    </div>
  {/if}

  {#if immersiveMode}
    <div class:playing={isAudioPlaying} class="immersive-visualizer" role="img" aria-label={isAudioPlaying ? `Live audio level for ${mixTitle}` : `${mixTitle} is paused`}>
      <div class="immersive-glow"></div>
      <div class="immersive-bars">
        {#each visualLevels as level}
          <i style={`height: ${Math.max(7, level * 1.8)}px; opacity: ${isAudioPlaying ? 0.7 + level / 120 : 0.34}`}></i>
        {/each}
      </div>
    </div>
  {:else}
  <main>
    {#key `${activeScene.id}:${weatherMatchActive}`}
      {#if weatherMatchActive && localWeather && activeWeatherProfile}
        <section class="scene-hero live-weather-hero" aria-label={`Live weather in ${localWeather.locationLabel}`}>
          <div class="weather-hero-primary">
            <p class="eyebrow">Live weather · {weatherMode === "match" ? "Mirror outside" : "Comforting contrast"}</p>
            <div class="weather-hero-reading">
              <strong>{localWeather.temperature}°</strong>
              <span>
                <b>{localWeather.locationLabel}</b>
                <small>{localWeather.label} · Feels like {localWeather.apparentTemperature ?? localWeather.temperature}°</small>
              </span>
            </div>
          </div>
          <div class="weather-hero-side">
            <p><strong>{activeWeatherProfile.title}</strong><span>{activeWeatherProfile.detail}</span><small>Matched to {activeScene.title}</small></p>
            <dl>
              <div><dt>Humidity</dt><dd>{localWeather.humidity ?? "—"}%</dd></div>
              <div><dt>Wind</dt><dd>{localWeather.windSpeed} {localWeather.windUnit}</dd></div>
              <div><dt>Rain</dt><dd>{localWeather.precipitation} {localWeather.precipitationUnit}</dd></div>
            </dl>
          </div>
        </section>
      {:else}
        <section class="scene-hero">
          <div>
            <p class="eyebrow">{activeScene.category}</p>
            <div class="hero-title-row">
              <h1>{activeScene.title}</h1>
              <button class:active={currentSceneFavorite} class="scene-favorite-button" type="button" aria-pressed={currentSceneFavorite} aria-label={currentSceneFavorite ? `Remove ${activeScene.title} from favorites` : `Add ${activeScene.title} to favorites`} title={currentSceneFavorite ? "Remove favorite" : "Favorite atmosphere"} on:click={toggleCurrentSceneFavorite}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.45 6.02.88-4.36 4.25 1.03 6-5.39-2.83-5.39 2.83 1.03-6-4.36-4.25 6.02-.88L12 3Z" /></svg>
              </button>
            </div>
          </div>
          <p>{activeScene.description}</p>
        </section>
      {/if}
    {/key}

    <div class="workspace">
      <section class="library-panel liquid-panel" aria-labelledby="atmosphere-heading">
        <div class="section-heading">
          <div>
            <p class="kicker">Library</p>
            <h2 id="atmosphere-heading">Choose an atmosphere</h2>
          </div>
          <button class:active={libraryToolsOpen} class="library-tools-toggle" type="button" aria-expanded={libraryToolsOpen} aria-controls="library-tools" on:click={toggleLibraryTools}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>
            <span>{libraryToolsOpen ? "Done" : "Browse"}</span>
          </button>
        </div>

        {#if libraryToolsOpen}
        <div id="library-tools" class="library-tools option-grid-enter">
        <div class="library-search-row">
          <label class="scene-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.4" /><path d="m15.4 15.4 4.1 4.1" /></svg>
            <span class="sr-only">Search atmospheres and sounds</span>
            <input bind:value={libraryQuery} type="search" placeholder="Search scenes or sounds" on:change={commitLibrarySearch} />
          </label>
          {#if libraryQuery}
            <button class="clear-search" type="button" aria-label="Clear atmosphere search" on:click={() => (libraryQuery = "")}>×</button>
          {/if}
        </div>

        <div class="category-filters" aria-label="Filter atmospheres">
          {#each sceneCategories as category}
            <button class:active={libraryCategory === category} type="button" aria-pressed={libraryCategory === category} on:click={() => setLibraryCategory(category)}>
              {#if category === "favorites"}<span aria-hidden="true">★</span>{/if}{formatCategory(category)}
            </button>
          {/each}
        </div>
        <span class="library-result-count">{filteredScenes.length} of {scenes.length} atmospheres</span>
        </div>
        {/if}

        {#if weatherCardVisible}
          <article class:active={weatherMatchActive} class:loading={["locating", "loading"].includes(weatherUiState)} class="live-weather-card">
            <button class="live-weather-card-main" type="button" aria-pressed={weatherMatchActive} on:click={requestLiveWeather}>
              <span class="live-weather-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M5.5 16.8h11.8a3.4 3.4 0 0 0 .2-6.8 5.4 5.4 0 0 0-10.3 1.3 2.9 2.9 0 0 0-1.7 5.5Z" /><path class="weather-card-rain" d="m8 19-1 2m5-2-1 2m5-2-1 2" /></svg>
              </span>
              <span class="live-weather-card-copy">
                <span><i>Live</i><strong>Current weather</strong></span>
                <small>{localWeather ? `${localWeather.temperature}${localWeather.unit} · ${localWeather.label} · ${localWeather.locationLabel}` : weatherUiState === "denied" ? "Location blocked · choose a city instead" : ["locating", "loading"].includes(weatherUiState) ? "Reading the conditions outside…" : "Match a video and sound mix to the weather outside"}</small>
              </span>
              <span class="live-weather-card-action">{weatherMatchActive ? "Rematch" : "Match now"}</span>
            </button>
            <button class="live-weather-card-settings" type="button" aria-label="Open Live Weather preferences" title="Live Weather preferences" on:click={() => openSettings("weather")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="M19 13.5a7.2 7.2 0 0 0 0-3l1.8-1.4-1.8-3-2.3.9a8 8 0 0 0-2.5-1.4L13.8 3h-3.6l-.4 2.6A8 8 0 0 0 7.3 7L5 6.1l-1.8 3L5 10.5a7.2 7.2 0 0 0 0 3l-1.8 1.4 1.8 3 2.3-.9a8 8 0 0 0 2.5 1.4l.4 2.6h3.6l.4-2.6a8 8 0 0 0 2.5-1.4l2.3.9 1.8-3-1.8-1.4Z" /></svg>
            </button>
          </article>
        {/if}

        {#if filteredScenes.length}
        <div class:expanded={libraryExpanded || Boolean(libraryQuery) || libraryCategory !== "all"} class="scene-grid">
          {#each filteredScenes as scene (scene.id)}
            <button
              type="button"
              class="scene-card"
              class:active={scenes.indexOf(scene) === activeIndex}
              aria-current={scenes.indexOf(scene) === activeIndex ? "true" : undefined}
              on:click={() => selectScene(scenes.indexOf(scene))}
            >
              <AtmosphereIcon scene={scene.id} active={scenes.indexOf(scene) === activeIndex} />
              <span class="scene-card-copy">
                <strong>{scene.title}</strong>
                <small>{scene.category}</small>
              </span>
              <span class:favorite={favoriteSceneIds.includes(scene.id)} class="scene-state" aria-hidden="true">{favoriteSceneIds.includes(scene.id) ? "★" : ""}</span>
            </button>
          {/each}
        </div>
        {#if filteredScenes.length > 8 && !libraryQuery && libraryCategory === "all"}
          <button class="mobile-library-more" type="button" aria-expanded={libraryExpanded} on:click={() => (libraryExpanded = !libraryExpanded)}>
            <span>{libraryExpanded ? "Show fewer atmospheres" : `Show all ${filteredScenes.length} atmospheres`}</span>
            <svg class:expanded={libraryExpanded} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
          </button>
        {/if}
        {:else if !weatherCardVisible}
          <div class="empty-library-state scene-empty"><strong>No atmosphere matches that search</strong><span>Try a broader sound, mood, or category.</span><button type="button" on:click={() => { libraryQuery = ""; libraryCategory = "all"; }}>Show everything</button></div>
        {/if}
      </section>

      <section class="mixer-panel liquid-panel" aria-labelledby="mixer-heading">
        <div class="section-heading mixer-heading">
          <h2 id="mixer-heading">Player</h2>
          <span>{audioError || (audioLoading ? "Loading" : isAudioPlaying ? "Playing" : audioStarted ? "Paused" : "Ready")}</span>
        </div>

        <div class="main-transport">
          <button
            class="audio-button"
            class:playing={isAudioPlaying}
            type="button"
            aria-label={`${isAudioPlaying ? "Pause" : "Play"} ${transportMediaLabel}`}
            title={dataSaverMode ? "Audio-only mode is active" : linkedPlayback ? "Controls sound and video together" : "Controls sound only"}
            on:click={togglePlayback}
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
            <strong>{mixTitle}</strong>
            <span>{mixNote}</span>
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
            on:change={commitVolume}
          />
          <output>{Math.round(volume * 100)}</output>
        </label>

        <button class:active={playerDetailsOpen} class="player-details-toggle" type="button" aria-expanded={playerDetailsOpen} aria-controls="player-details" on:click={togglePlayerDetails}>
          <span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>
            <strong>Customize</strong>
          </span>
          <small>Layers, mixes and video</small>
          <svg class="disclosure-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
        </button>

        {#if playerDetailsOpen}
        <div id="player-details" class="player-details option-grid-enter">
        {#if activeSoundCategories.length}
          <section class="sound-category-browser" aria-labelledby="sound-category-heading">
            <div class="sound-category-heading">
              <div>
                <p class="kicker">{activeScene.title}</p>
                <h3 id="sound-category-heading">Choose a sound category</h3>
              </div>
              <span>{activeSoundCategories.length} {activeSoundCategories.length === 1 ? "category" : "categories"}</span>
            </div>
            <div class="sound-category-list" aria-label={`${activeScene.title} sound categories`}>
              {#each activeSoundCategories as subcategory (subcategory.id)}
                <button class:active={subcategory.id === selectedSoundCategory} type="button" aria-pressed={subcategory.id === selectedSoundCategory} on:click={() => selectSoundCategory(subcategory)}>
                  <span class="sound-category-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><path d="m5 13 1.8-4h10.4l1.8 4v5H5v-5Z" /><path d="M7 13h10M8 18v2M16 18v2" /><circle cx="8" cy="15.5" r=".8" /><circle cx="16" cy="15.5" r=".8" /><path class="sound-category-road" d="M4 22h4m4 0h4m4 0h1" /></svg>
                  </span>
                  <span class="sound-category-copy"><strong>{subcategory.title}</strong><small>{subcategory.description}</small></span>
                  <span class="sound-category-count">{subcategory.trackIndices.length} sounds</span>
                </button>
              {/each}
            </div>
          </section>
        {/if}

        <div class="mix-action-row" aria-label="Mix actions">
          <button type="button" on:click={openSaveMix}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h12l2 2V20H5V4.5Z" /><path d="M8 4.5v5h8v-5M8.5 20v-6h7v6" /></svg>
            <span>Save mix</span>
          </button>
          <button type="button" on:click={() => shareMix()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.4" /><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="19" r="2.4" /><path d="m8.1 10.8 7.8-4.6M8.1 13.2l7.8 4.6" /></svg>
            <span>Share</span>
          </button>
          <button class:active={mixEditorOpen} type="button" aria-expanded={mixEditorOpen} aria-controls="mix-editor" on:click={() => (mixEditorOpen = !mixEditorOpen)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></svg>
            <span>{mixEditorOpen ? "Done" : "Layers"}</span>
          </button>
        </div>

        {#if selectedAudios.length > 1}
        <section class="now-mixing-tray" aria-labelledby="now-mixing-heading">
          <div class="now-mixing-heading">
            <div>
              <p class="kicker">Now mixing</p>
              <h3 id="now-mixing-heading">{selectedAudios.length} sounds</h3>
            </div>
          </div>
          <div class="layer-chip-row">
            {#each selectedAudios as index (activeScene.audioTracks[index]?.id)}
              <div class="layer-chip">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13v-2M8.5 16V8M12 18V6M15.5 15V9M19 13v-2" /></svg>
                <span>{activeScene.audioTracks[index]?.title}</span>
                <span class="layer-chip-level" aria-hidden="true"><i style={`width: ${Math.round(getLayerVolume(index) * 100)}%`}></i></span>
                {#if selectedAudios.length > 1}
                  <button type="button" aria-label={`Remove ${activeScene.audioTracks[index]?.title} from mix`} title="Remove layer" on:click={() => removeSelectedLayer(index)}>×</button>
                {/if}
              </div>
            {/each}
          </div>
        </section>
        {/if}

        {#if mixEditorOpen}
          <div id="mix-editor" class="option-section mix-editor option-grid-enter">
            <div class="option-heading mix-editor-heading">
              <div>
                <h3>Fine tune</h3>
                <span>Choose sounds and adjust each layer</span>
              </div>
              <button class:active={multiSoundEnabled} type="button" aria-pressed={multiSoundEnabled} on:click={() => setMultiSoundEnabled(!multiSoundEnabled)}>
                {multiSoundEnabled ? "Layering on" : "Enable layering"}
              </button>
            </div>
            {#key activeScene.id}
              <div class="track-grid">
                {#each visibleAudioTracks as entry (entry.track.id)}
                  <article class:active={selectedAudios.includes(entry.index)} class="track-item">
                    <button
                      type="button"
                      class="track-card"
                      class:active={selectedAudios.includes(entry.index)}
                      aria-pressed={selectedAudios.includes(entry.index)}
                      on:click={() => selectTrack(entry.index)}
                    >
                      <svg class="option-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13v-2M8.5 16V8M12 18V6M15.5 15V9M19 13v-2" /></svg>
                      <span class="option-copy"><strong>{entry.track.title}</strong><small>{entry.track.note}</small></span>
                      <span class="selection-dot" aria-hidden="true"></span>
                    </button>
                    {#if selectedAudios.includes(entry.index)}
                      <label class="layer-volume">
                        <span class="sr-only">{entry.track.title} layer</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={layerVolumes[entry.track.id] ?? 1}
                          style={`--volume-percent: ${Math.round((layerVolumes[entry.track.id] ?? 1) * 100)}%`}
                          aria-label={`${entry.track.title} layer volume`}
                          aria-valuetext={`${Math.round((layerVolumes[entry.track.id] ?? 1) * 100)} percent`}
                          on:input={(event) => updateLayerVolume(entry.index, event)}
                          on:change={() => commitLayerVolume(entry.index)}
                        />
                      </label>
                    {/if}
                  </article>
                {/each}
              </div>
            {/key}
          </div>
        {/if}

        <div class="option-section video-section">
          <div class="option-heading">
            <h3>Video loops</h3>
            <span>{dataSaverMode ? "Audio only" : `${visibleVideoLoops.length} views`}</span>
          </div>
          {#if dataSaverMode}<p class="data-saver-note">Video downloads are paused. Choose a view now and it will appear when Audio only is turned off.</p>{/if}
          {#key activeScene.id}
            <div class="video-grid option-grid-enter">
              {#each visibleVideoLoops as entry (entry.loop.id)}
                <button
                  type="button"
                  class="video-card"
                  class:active={selectedVideo === entry.index}
                  aria-pressed={selectedVideo === entry.index}
                  on:click={() => selectVideo(entry.index)}
                >
                  <svg class="option-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="m9.5 9 5 3-5 3V9Z" /></svg>
                  <strong>{entry.loop.title}</strong>
                  <span class="selection-dot" aria-hidden="true"></span>
                </button>
              {/each}
            </div>
          {/key}
        </div>
        </div>
        {/if}
      </section>

    </div>
  </main>

  <aside class:closed={!recipesOpen} class="recipe-drawer" aria-labelledby="recommendation-heading">
    <button class="recipe-drawer-handle" type="button" aria-expanded={recipesOpen} aria-controls="sound-recipe-panel" aria-label={recipesOpen ? "Hide mixes" : "Show mixes"} title={recipesOpen ? "Hide mixes" : "Show mixes"} on:click={toggleRecipes}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      <span>Mixes</span>
    </button>
    <div id="sound-recipe-panel" class="recommendation-panel liquid-panel" aria-hidden={!recipesOpen} inert={!recipesOpen}>
      <div class="mix-drawer-sticky">
        <div class="mix-drawer-heading">
          <div>
            <p class="kicker">Mixes</p>
            <h2 id="recommendation-heading">Find your atmosphere</h2>
          </div>
          <button type="button" aria-label="Close mixes" title="Close" on:click={toggleRecipes}>×</button>
        </div>

        <div class="mix-drawer-tabs" role="tablist" aria-label="Mix collections">
          <button class:active={mixDrawerTab === "for-you"} type="button" role="tab" aria-selected={mixDrawerTab === "for-you"} on:click={() => selectMixDrawerTab("for-you")}>For you</button>
          <button class:active={mixDrawerTab === "saved"} type="button" role="tab" aria-selected={mixDrawerTab === "saved"} on:click={() => selectMixDrawerTab("saved")}>Saved{savedMixes.length ? ` ${savedMixes.length}` : ""}</button>
          <button class:active={mixDrawerTab === "recent"} type="button" role="tab" aria-selected={mixDrawerTab === "recent"} on:click={() => selectMixDrawerTab("recent")}>Recent</button>
        </div>

        {#if mixDrawerTab === "for-you"}
          <div class="mix-intent-filters" aria-label="Filter recommended mixes">
            {#each mixIntents as intent}
              <button class:active={mixIntent === intent} type="button" aria-pressed={mixIntent === intent} on:click={() => selectMixIntent(intent)}>{formatCategory(intent)}</button>
            {/each}
          </div>
        {/if}
      </div>

      {#if mixDrawerTab === "for-you"}
        <div class="recipe-list" role="tabpanel">
          {#each visibleSoundRecipes as recipe}
            <article class="recipe-card">
              <div class="recipe-card-copy">
                <div class="recipe-card-title">
                  <div class="mix-stack" aria-hidden="true">
                    {#each recipe.tracks.slice(0, 3) as track, index}
                      <i style={`--stack-index: ${index}`}></i>
                    {/each}
                  </div>
                  <div>
                    <h3>{recipe.title}</h3>
                    <p>{recipe.intent} · {scenes[recipe.sceneIndex]?.title}</p>
                  </div>
                </div>
                <span>{recipe.detail}</span>
                <div class="recipe-track-list" aria-label="Sounds in this mix">
                  {#each recipe.tracks.slice(0, 3) as track}<i>{track.title}</i>{/each}
                </div>
              </div>
              <button class="recipe-play" type="button" aria-label={`Play ${recipe.title} mix`} title={`Play ${recipe.title}`} on:click={() => applyRecipe(recipe)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" /></svg>
              </button>
            </article>
          {/each}
        </div>
      {:else if mixDrawerTab === "saved"}
        <div class="mix-personal-list" role="tabpanel">
          {#if savedMixes.length}
            {#each savedMixes as mix (mix.id)}
              <article class="mix-library-card">
                <button class="mix-library-load" type="button" on:click={() => applyMixSnapshot(mix)}>
                  <span class="mix-library-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 6 9 6-9 6V6Z" /></svg></span>
                  <span><strong>{mix.name || getMixScene(mix).title}</strong><small>{getMixDescription(mix)}</small></span>
                </button>
                <div class="mix-library-actions">
                  <button class:active={mix.favorite} type="button" aria-label={mix.favorite ? "Remove favorite mix" : "Favorite mix"} title="Favorite" on:click={() => toggleSavedMixFavorite(mix.id)}>★</button>
                  <button type="button" aria-label={`Share ${mix.name || "mix"}`} title="Share" on:click={() => shareMix(mix)}>↗</button>
                </div>
              </article>
            {/each}
            <button class="mix-manage-button" type="button" on:click={() => openSettings("mixes")}>Manage saved mixes</button>
          {:else}
            <div class="mix-empty-state"><strong>No saved mixes yet</strong><span>Build a soundscape, then use Save mix beside the player.</span></div>
          {/if}
        </div>
      {:else}
        <div class="mix-personal-list" role="tabpanel">
          {#if recentMixes.length}
            {#each recentMixes as mix}
              <button class="mix-recent-card" type="button" on:click={() => applyMixSnapshot(mix, "recent_mix")}>
                <span class="mix-library-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m9 6 9 6-9 6V6Z" /></svg></span>
                <span><strong>{getMixScene(mix).title}</strong><small>{getMixTrackNames(mix).slice(0, 3).join(" · ")}</small></span>
              </button>
            {/each}
            <button class="mix-manage-button" type="button" on:click={clearRecentMixes}>Clear recent mixes</button>
          {:else}
            <div class="mix-empty-state"><strong>Nothing played recently</strong><span>Your recent soundscapes will appear here.</span></div>
          {/if}
        </div>
      {/if}
    </div>
  </aside>
  {/if}
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

  .topbar.immersive {
    right: 0;
    padding: 22px clamp(18px, 3.5vw, 52px);
    border: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .topbar.immersive .wordmark-copy { display: none; }
  .topbar.immersive .brand-icon { box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.13), 0 8px 28px rgba(0, 0, 0, 0.32), 0 0 28px rgba(var(--accent-rgb), 0.18); }

  .topbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .topbar-actions .glass-button {
    width: 42px;
    height: 42px;
    justify-content: center;
    padding: 0;
  }

  .topbar-actions .glass-button span { display: none; }

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

  .quiet-view-button {
    position: fixed;
    z-index: 24;
    left: clamp(18px, 3.5vw, 52px);
    bottom: 24px;
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.78);
    background:
      radial-gradient(circle at 24% 10%, rgba(var(--accent-rgb), 0.14), transparent 54%),
      rgba(18, 21, 23, 0.48);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 12px 34px rgba(0, 0, 0, 0.26), 0 0 28px rgba(var(--accent-rgb), 0.08);
    backdrop-filter: blur(22px) saturate(145%);
    -webkit-backdrop-filter: blur(22px) saturate(145%);
    cursor: pointer;
    animation: quiet-button-in 560ms 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
    transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), color 200ms ease, border-color 200ms ease, background 240ms ease, box-shadow 240ms ease;
  }

  @keyframes quiet-button-in { from { opacity: 0; transform: translateY(12px) scale(0.9); } to { opacity: 1; transform: none; } }
  .quiet-view-button:hover { transform: translateY(-3px) scale(1.035); color: #fff; border-color: rgba(var(--accent-rgb), 0.46); background: rgba(29, 33, 36, 0.62); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 16px 42px rgba(0, 0, 0, 0.3), 0 0 34px rgba(var(--accent-rgb), 0.14); }
  .quiet-view-button:active { transform: scale(0.94); }
  .quiet-view-button svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
  .quiet-view-button .quiet-wave { stroke: var(--accent); filter: drop-shadow(0 0 4px rgba(var(--accent-rgb), 0.5)); }

  .video-toggle svg,
  .pip-toggle svg,
  .settings-button svg {
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

  .pip-toggle.pip-off {
    color: rgba(255, 255, 255, 0.48);
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(16, 18, 20, 0.54);
  }

  .pip-off-mark {
    stroke: rgba(255, 255, 255, 0.78);
    stroke-width: 2.1;
  }

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

  .analytics-consent {
    position: fixed;
    z-index: 44;
    left: 50%;
    bottom: 24px;
    width: min(570px, calc(100vw - 32px));
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 14px;
    padding: 18px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 26px;
    color: #f7f7f4;
    background: linear-gradient(145deg, rgba(29, 32, 35, 0.91), rgba(10, 12, 14, 0.84));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 28px 90px rgba(0, 0, 0, 0.46), 0 0 48px rgba(var(--accent-rgb), 0.08);
    backdrop-filter: blur(28px) saturate(145%);
    -webkit-backdrop-filter: blur(28px) saturate(145%);
    transform: translateX(-50%);
    animation: analytics-consent-in 440ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes analytics-consent-in {
    from { opacity: 0; transform: translate(-50%, 18px) scale(0.97); filter: blur(8px); }
    to { opacity: 1; transform: translateX(-50%); filter: none; }
  }

  .analytics-consent-icon { width: 46px; height: 46px; display: grid; place-items: center; border: 1px solid rgba(var(--accent-rgb), 0.34); border-radius: 15px; color: var(--accent); background: rgba(var(--accent-rgb), 0.11); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1); }
  .analytics-consent-icon svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
  .analytics-consent h2 { margin: 0; font-size: 1.12rem; font-weight: 520; letter-spacing: -0.03em; }
  .analytics-consent #analytics-consent-copy { margin: 7px 0 0; color: rgba(255, 255, 255, 0.55); font-size: 0.73rem; line-height: 1.5; }
  .analytics-consent-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 7px; }
  .analytics-consent-actions button { min-height: 38px; padding: 9px 14px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; color: rgba(255, 255, 255, 0.72); background: rgba(255, 255, 255, 0.06); cursor: pointer; transition: transform 180ms ease, color 180ms ease, border-color 180ms ease, background 180ms ease; }
  .analytics-consent-actions button:hover { transform: translateY(-1px); color: #fff; border-color: rgba(var(--accent-rgb), 0.4); }
  .analytics-consent-actions .analytics-allow { color: #101214; border-color: transparent; background: rgba(var(--accent-rgb), 0.94); }

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
    transition: padding-right 520ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .scene-hero {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 40px;
    min-height: 145px;
    margin-bottom: 22px;
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
    font-size: clamp(3.8rem, 7vw, 7.4rem);
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
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .live-weather-hero {
    min-height: 190px;
    align-items: end;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(330px, 0.62fr);
    gap: clamp(34px, 6vw, 90px);
  }

  .weather-hero-primary { min-width: 0; }
  .weather-hero-reading { display: flex; align-items: flex-end; gap: clamp(18px, 2.4vw, 34px); }
  .weather-hero-reading > strong {
    font-size: clamp(5.4rem, 10vw, 10rem);
    font-weight: 350;
    font-variant-numeric: tabular-nums;
    line-height: 0.72;
    letter-spacing: -0.09em;
    text-shadow: 0 0 46px rgba(var(--accent-rgb), 0.15);
  }
  .weather-hero-reading > span { min-width: 0; display: grid; gap: 6px; padding-bottom: 3px; }
  .weather-hero-reading b { overflow: hidden; font-size: clamp(1.45rem, 2.6vw, 2.4rem); font-weight: 470; letter-spacing: -0.045em; text-overflow: ellipsis; white-space: nowrap; }
  .weather-hero-reading small { color: rgba(255, 255, 255, 0.62); font-size: 0.78rem; }

  .weather-hero-side { display: grid; gap: 18px; padding-bottom: 4px; }
  .weather-hero-side > p { display: grid; gap: 5px; margin: 0; }
  .weather-hero-side > p strong { font-size: 0.95rem; font-weight: 560; }
  .weather-hero-side > p span { color: rgba(255, 255, 255, 0.62); font-size: 0.73rem; line-height: 1.5; }
  .weather-hero-side > p small { color: rgba(var(--accent-rgb), 0.84); font-size: 0.64rem; }
  .weather-hero-side dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 0; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.13); }
  .weather-hero-side dl div { display: grid; gap: 4px; }
  .weather-hero-side dt { color: rgba(255, 255, 255, 0.4); font-size: 0.59rem; text-transform: uppercase; letter-spacing: 0.08em; }
  .weather-hero-side dd { margin: 0; font-size: 0.72rem; font-variant-numeric: tabular-nums; }

  .workspace {
    display: grid;
    grid-template-columns: minmax(430px, 1.18fr) minmax(320px, 0.76fr);
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
  .mixer-panel,
  .recommendation-panel { padding: clamp(20px, 2.2vw, 30px); }

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

  .mobile-library-more {
    width: 100%;
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 9px;
    border: 1px solid rgba(255, 255, 255, 0.065);
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    font-size: 0.62rem;
    font-weight: 560;
    transition: color 180ms ease, border-color 180ms ease, background 180ms ease;
  }
  .mobile-library-more:hover { color: #fff; border-color: rgba(var(--accent-rgb), 0.25); background: rgba(var(--accent-rgb), 0.055); }
  .mobile-library-more svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; transition: transform 260ms ease; }
  .mobile-library-more svg.expanded { transform: rotate(180deg); }

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
    min-height: 78px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 17px;
  }

  .scene-grid:not(.expanded) .scene-card:nth-child(n+13):not(.active) { display: none; }

  .scene-card.active {
    color: #111315;
    border-color: rgba(var(--accent-rgb), 0.8);
    background: linear-gradient(145deg, rgba(248, 248, 244, 0.96), rgba(var(--accent-rgb), 0.82));
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16), 0 0 30px rgba(var(--accent-rgb), 0.13), inset 0 1px 0 white;
  }

  .scene-card-copy,
  .option-copy { display: grid; gap: 4px; min-width: 0; }
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

  .mixer-panel {
    background:
      radial-gradient(circle at 12% 0%, rgba(var(--accent-rgb), 0.1), transparent 43%),
      linear-gradient(145deg, rgba(25, 28, 30, 0.92), rgba(11, 14, 16, 0.86));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.13), 0 28px 90px rgba(0, 0, 0, 0.31), 0 0 54px rgba(var(--accent-rgb), 0.045);
    backdrop-filter: blur(30px) saturate(132%);
    -webkit-backdrop-filter: blur(30px) saturate(132%);
    animation: panel-rise 650ms 90ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  .library-panel { animation: panel-rise 650ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes panel-rise { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }

  .mixer-heading { align-items: center; margin-bottom: 0; padding-bottom: 11px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); }
  .mixer-heading h2 { color: rgba(255, 255, 255, 0.5); font-size: 0.63rem; font-weight: 680; letter-spacing: 0.13em; text-transform: uppercase; }
  .mixer-heading > span { padding: 4px 8px; border-radius: 999px; color: rgba(var(--accent-rgb), 0.88); background: rgba(var(--accent-rgb), 0.075); font-size: 0.57rem; font-weight: 650; letter-spacing: 0.04em; text-transform: uppercase; }

  .main-transport {
    position: relative;
    min-height: 98px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-items: center;
    column-gap: 15px;
    row-gap: 5px;
    padding: 13px 0 10px;
  }

  .audio-button {
    grid-row: 1 / 3;
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.42);
    border-radius: 50%;
    background: rgba(28, 31, 33, 0.82);
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.42);
    backdrop-filter: blur(14px);
    cursor: pointer;
    transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1), background 260ms ease, box-shadow 260ms ease;
  }

  .audio-button:hover { transform: scale(1.045); background: rgba(43, 47, 50, 0.92); }
  .audio-button:active { transform: scale(0.94); }
  .audio-button.playing { box-shadow: 0 0 0 7px rgba(var(--accent-rgb), 0.1), 0 16px 44px rgba(0, 0, 0, 0.24), 0 0 34px rgba(var(--accent-rgb), 0.16); }

  .audio-button-core {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: #111315;
    background: rgba(250, 250, 247, 0.96);
    box-shadow: 0 5px 16px rgba(0, 0, 0, 0.18);
  }

  .audio-button svg {
    width: 21px;
    height: 21px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .play-mark { margin-left: 2px; }

  .equalizer {
    grid-column: 2;
    grid-row: 2;
    height: 22px;
    display: flex;
    align-items: center;
    align-self: start;
    gap: 3px;
    padding: 0;
  }

  .equalizer i {
    width: 3px;
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(to top, rgba(255, 255, 255, 0.5), var(--accent));
    transform-origin: center;
    transition: height 70ms linear, opacity 120ms ease, background 480ms ease;
  }

  .now-playing { min-width: 0; grid-column: 2; grid-row: 1; display: grid; align-self: end; gap: 4px; }
  .now-playing strong { overflow: hidden; font-size: 0.94rem; font-weight: 570; text-overflow: ellipsis; white-space: nowrap; }
  .now-playing span { overflow: hidden; color: rgba(255, 255, 255, 0.42); font-size: 0.65rem; text-overflow: ellipsis; white-space: nowrap; }

  .volume-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) 28px;
    align-items: center;
    gap: 13px;
    padding: 10px 2px 2px;
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 0;
    color: rgba(255, 255, 255, 0.64);
    background: transparent;
    font-size: 0.74rem;
  }

  .volume-row input,
  .layer-volume input {
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

  .volume-row input::-webkit-slider-runnable-track,
  .layer-volume input::-webkit-slider-runnable-track {
    height: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background:
      linear-gradient(90deg, rgba(var(--accent-rgb), 0.92) 0 var(--volume-percent), rgba(255, 255, 255, 0.1) var(--volume-percent) 100%);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.38), 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .volume-row input::-webkit-slider-thumb,
  .layer-volume input::-webkit-slider-thumb {
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

  .volume-row input::-moz-range-track,
  .layer-volume input::-moz-range-track {
    height: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.38);
  }

  .volume-row input::-moz-range-progress,
  .layer-volume input::-moz-range-progress {
    height: 8px;
    border-radius: 999px;
    background: rgba(var(--accent-rgb), 0.92);
  }

  .volume-row input::-moz-range-thumb,
  .layer-volume input::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border: 1px solid rgba(255, 255, 255, 0.68);
    border-radius: 50%;
    background: rgba(var(--accent-rgb), 0.96);
    box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.12), 0 5px 14px rgba(0, 0, 0, 0.42), inset 0 1px 0 #fff;
    transition: transform 160ms ease, box-shadow 260ms ease;
  }

  .volume-row input:hover::-webkit-slider-thumb,
  .volume-row input:focus-visible::-webkit-slider-thumb,
  .layer-volume input:hover::-webkit-slider-thumb,
  .layer-volume input:focus-visible::-webkit-slider-thumb { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(var(--accent-rgb), 0.18), 0 6px 18px rgba(0, 0, 0, 0.46), inset 0 1px 0 #fff; }
  .volume-row input:hover::-moz-range-thumb,
  .volume-row input:focus-visible::-moz-range-thumb,
  .layer-volume input:hover::-moz-range-thumb,
  .layer-volume input:focus-visible::-moz-range-thumb { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(var(--accent-rgb), 0.18), 0 6px 18px rgba(0, 0, 0, 0.46), inset 0 1px 0 #fff; }
  .volume-row input:active::-webkit-slider-thumb,
  .layer-volume input:active::-webkit-slider-thumb { transform: scale(0.92); }
  .volume-row input:active::-moz-range-thumb,
  .layer-volume input:active::-moz-range-thumb { transform: scale(0.92); }
  .volume-row output { color: rgba(255, 255, 255, 0.88); font-variant-numeric: tabular-nums; text-align: right; }

  .player-details-toggle {
    width: 100%;
    min-height: 42px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    margin-top: 11px;
    padding: 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.065);
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.48);
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    text-align: left;
    transition: color 180ms ease, border-color 180ms ease, background 180ms ease;
  }
  .player-details-toggle:hover,
  .player-details-toggle.active { color: #fff; border-color: rgba(var(--accent-rgb), 0.26); background: rgba(var(--accent-rgb), 0.055); }
  .player-details-toggle > span { display: inline-flex; align-items: center; gap: 7px; }
  .player-details-toggle strong { font-size: 0.64rem; font-weight: 580; }
  .player-details-toggle small { overflow: hidden; color: rgba(255, 255, 255, 0.31); font-size: 0.58rem; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
  .player-details-toggle svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
  .player-details-toggle .disclosure-arrow { color: rgba(255, 255, 255, 0.32); transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1); }
  .player-details-toggle.active .disclosure-arrow { transform: rotate(180deg); }
  .player-details { padding-top: 2px; }

  .option-section { margin-top: 24px; }
  .option-heading { align-items: center; margin-bottom: 10px; padding: 0 2px; }
  .track-grid,
  .video-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }

  .option-grid-enter { animation: options-in 480ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes options-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .track-card {
    min-height: 56px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    border-radius: 15px;
  }

  .track-item:last-child:nth-child(odd) { grid-column: 1 / -1; }

  .video-section { padding-top: 21px; border-top: 1px solid rgba(255, 255, 255, 0.1); }

  .video-card {
    min-height: 54px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 11px;
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(15, 18, 20, 0.42);
  }

  .track-card.active,
  .video-card.active {
    color: rgba(255, 255, 255, 0.94);
    border-color: rgba(var(--accent-rgb), 0.42);
    background: rgba(var(--accent-rgb), 0.1);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055), 0 0 22px rgba(var(--accent-rgb), 0.05);
  }

  .option-icon {
    width: 17px;
    height: 17px;
    flex: 0 0 17px;
    fill: none;
    stroke: rgba(255, 255, 255, 0.38);
    stroke-width: 1.45;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: color 200ms ease, stroke 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .active > .option-icon {
    stroke: var(--accent);
    transform: scale(1.05);
    filter: drop-shadow(0 0 6px rgba(var(--accent-rgb), 0.3));
  }

  .selection-dot {
    width: 7px;
    height: 7px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 50%;
    background: transparent;
    transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
  }

  .active > .selection-dot {
    border-color: var(--accent);
    background: var(--accent);
    box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.5);
  }

  .video-card strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.76rem; }

  .recipe-drawer {
    position: fixed;
    z-index: 24;
    top: 94px;
    right: 16px;
    width: min(720px, calc(100vw - 116px));
    transform: translateX(0);
    transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .recipe-drawer.closed { transform: translateX(calc(100% + 16px)); }

  .recipe-drawer-handle {
    position: absolute;
    z-index: 2;
    top: 28px;
    left: -84px;
    width: 85px;
    height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 13px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-right-color: rgba(255, 255, 255, 0.07);
    border-radius: 16px 0 0 16px;
    color: rgba(255, 255, 255, 0.8);
    background: rgba(18, 21, 23, 0.72);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), -8px 12px 28px rgba(0, 0, 0, 0.2), 0 0 24px rgba(var(--accent-rgb), 0.06);
    backdrop-filter: blur(26px) saturate(135%);
    -webkit-backdrop-filter: blur(26px) saturate(135%);
    cursor: pointer;
    font-size: 0.66rem;
    font-weight: 620;
    letter-spacing: 0.02em;
    transition: color 200ms ease, background 200ms ease, border-color 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .recipe-drawer-handle:hover { color: #fff; border-color: rgba(var(--accent-rgb), 0.36); background: rgba(29, 33, 36, 0.8); }
  .recipe-drawer-handle svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1); }
  .recipe-drawer.closed .recipe-drawer-handle svg { transform: rotate(180deg); }

  .recommendation-panel {
    --mix-panel-pad: 20px;
    width: 100%;
    max-height: calc(100svh - 112px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: var(--mix-panel-pad);
    background:
      radial-gradient(circle at 12% 0%, rgba(var(--accent-rgb), 0.11), transparent 38%),
      linear-gradient(155deg, rgba(27, 31, 33, 0.86), rgba(11, 13, 15, 0.8));
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--accent-rgb), 0.34) transparent;
  }

  .mix-drawer-sticky {
    position: sticky;
    z-index: 3;
    top: calc(var(--mix-panel-pad) * -1);
    margin: calc(var(--mix-panel-pad) * -1) calc(var(--mix-panel-pad) * -1) 12px;
    padding: var(--mix-panel-pad) var(--mix-panel-pad) 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
    background:
      radial-gradient(circle at 12% 0%, rgba(var(--accent-rgb), 0.13), transparent 45%),
      linear-gradient(180deg, rgba(25, 29, 31, 0.97), rgba(18, 21, 23, 0.9));
    box-shadow: 0 16px 26px rgba(7, 9, 10, 0.16);
    backdrop-filter: blur(26px) saturate(140%);
    -webkit-backdrop-filter: blur(26px) saturate(140%);
  }

  .mix-drawer-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; margin-bottom: 17px; }
  .mix-drawer-heading h2 { margin: 4px 0 0; font-size: 1.35rem; font-weight: 470; letter-spacing: -0.04em; }
  .mix-drawer-heading > button { width: 34px; height: 34px; display: grid; place-items: center; flex: 0 0 auto; padding: 0; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 50%; color: rgba(255, 255, 255, 0.56); background: rgba(255, 255, 255, 0.04); cursor: pointer; font-size: 1rem; transition: color 180ms ease, background 180ms ease, transform 220ms ease; }
  .mix-drawer-heading > button:hover { color: #fff; background: rgba(255, 255, 255, 0.09); transform: rotate(6deg); }

  .mix-drawer-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; border: 1px solid rgba(255, 255, 255, 0.075); border-radius: 15px; background: rgba(7, 9, 11, 0.3); }
  .mix-drawer-tabs button { min-height: 36px; padding: 7px 8px; border: 0; border-radius: 11px; color: rgba(255, 255, 255, 0.43); background: transparent; cursor: pointer; font-size: 0.63rem; transition: color 180ms ease, background 180ms ease, box-shadow 180ms ease; }
  .mix-drawer-tabs button:hover { color: rgba(255, 255, 255, 0.8); }
  .mix-drawer-tabs button.active { color: #fff; background: rgba(255, 255, 255, 0.075); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07); }

  .mix-intent-filters { display: flex; gap: 5px; overflow-x: auto; margin: 13px 0 11px; padding-bottom: 2px; scrollbar-width: none; }
  .mix-intent-filters::-webkit-scrollbar { display: none; }
  .mix-intent-filters button { min-height: 29px; flex: 0 0 auto; padding: 6px 10px; border: 1px solid rgba(255, 255, 255, 0.075); border-radius: 999px; color: rgba(255, 255, 255, 0.4); background: rgba(255, 255, 255, 0.025); cursor: pointer; font-size: 0.58rem; }
  .mix-intent-filters button.active { color: #111315; border-color: transparent; background: rgba(var(--accent-rgb), 0.92); }

  .recipe-list,
  .mix-personal-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 0; }

  .mix-manage-button,
  .mix-empty-state { grid-column: 1 / -1; }

  .recipe-card {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    min-height: 110px;
    padding: 14px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 18px;
    background: rgba(15, 18, 20, 0.46);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transition: border-color 220ms ease, background 220ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .recipe-card::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.38;
    background: radial-gradient(circle at 0 0, rgba(var(--accent-rgb), 0.15), transparent 52%);
  }

  .recipe-card:hover { transform: translateY(-1px); border-color: rgba(var(--accent-rgb), 0.27); background: rgba(23, 27, 29, 0.62); }
  .recipe-card-copy { position: relative; min-width: 0; display: grid; gap: 8px; }
  .recipe-card-title { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .recipe-card-title > div:last-child { min-width: 0; }
  .recipe-card h3,
  .recipe-card p,
  .recipe-card-copy > span { margin: 0; }
  .recipe-card h3 { overflow: hidden; color: rgba(255, 255, 255, 0.9); font-size: 0.77rem; font-weight: 580; text-overflow: ellipsis; white-space: nowrap; }
  .recipe-card p { margin-top: 3px; color: rgba(var(--accent-rgb), 0.72); font-size: 0.54rem; font-weight: 630; letter-spacing: 0.07em; text-transform: uppercase; }
  .recipe-card-copy > span { color: rgba(255, 255, 255, 0.39); font-size: 0.62rem; line-height: 1.42; }
  .mix-stack { width: 34px; height: 28px; position: relative; flex: 0 0 34px; }
  .mix-stack i { position: absolute; top: calc(var(--stack-index) * 3px); left: calc(var(--stack-index) * 8px); width: 22px; height: 22px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 50%; background: rgba(var(--accent-rgb), 0.42); box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25); }
  .mix-stack i:nth-child(2) { opacity: 0.76; }
  .mix-stack i:nth-child(3) { opacity: 0.56; }
  .recipe-track-list { display: flex; gap: 4px; overflow: hidden; }
  .recipe-track-list i { overflow: hidden; max-width: 92px; padding: 4px 7px; border-radius: 999px; color: rgba(255, 255, 255, 0.42); background: rgba(255, 255, 255, 0.045); font-size: 0.52rem; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }

  .recipe-play { position: relative; width: 40px; height: 40px; display: grid; place-items: center; flex: 0 0 auto; padding: 0; border: 1px solid rgba(var(--accent-rgb), 0.36); border-radius: 50%; color: #111315; background: rgba(var(--accent-rgb), 0.92); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.36), 0 7px 20px rgba(var(--accent-rgb), 0.09); cursor: pointer; transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 180ms ease; }
  .recipe-play:hover { transform: scale(1.06); filter: brightness(1.08); }
  .recipe-play:active { transform: scale(0.94); }
  .recipe-play svg { width: 14px; height: 14px; margin-left: 2px; fill: currentColor; stroke: none; }

  .mix-library-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 7px; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.075); border-radius: 16px; background: rgba(15, 18, 20, 0.46); }
  .mix-library-load,
  .mix-recent-card { min-width: 0; display: flex; align-items: center; gap: 10px; padding: 8px; border: 0; color: rgba(255, 255, 255, 0.78); background: transparent; cursor: pointer; text-align: left; }
  .mix-recent-card { width: 100%; border: 1px solid rgba(255, 255, 255, 0.075); border-radius: 16px; background: rgba(15, 18, 20, 0.46); }
  .mix-library-load > span:last-child,
  .mix-recent-card > span:last-child { min-width: 0; display: grid; gap: 4px; }
  .mix-library-load strong,
  .mix-recent-card strong { overflow: hidden; font-size: 0.7rem; font-weight: 570; text-overflow: ellipsis; white-space: nowrap; }
  .mix-library-load small,
  .mix-recent-card small { overflow: hidden; color: rgba(255, 255, 255, 0.36); font-size: 0.56rem; text-overflow: ellipsis; white-space: nowrap; }
  .mix-library-icon { width: 32px; height: 32px; display: grid; place-items: center; flex: 0 0 auto; border: 1px solid rgba(var(--accent-rgb), 0.2); border-radius: 50%; color: var(--accent); background: rgba(var(--accent-rgb), 0.07); }
  .mix-library-icon svg { width: 12px; height: 12px; margin-left: 1px; fill: currentColor; }
  .mix-library-actions { display: flex; gap: 3px; }
  .mix-library-actions button { width: 30px; height: 30px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 9px; color: rgba(255, 255, 255, 0.36); background: transparent; cursor: pointer; }
  .mix-library-actions button:hover,
  .mix-library-actions button.active { color: var(--accent); background: rgba(var(--accent-rgb), 0.08); }
  .mix-manage-button { justify-self: center; margin-top: 6px; padding: 8px 11px; border: 0; color: rgba(var(--accent-rgb), 0.78); background: transparent; cursor: pointer; font-size: 0.6rem; }
  .mix-empty-state { min-height: 180px; display: grid; align-content: center; justify-items: center; gap: 7px; padding: 24px; color: rgba(255, 255, 255, 0.66); text-align: center; }
  .mix-empty-state strong { font-size: 0.8rem; font-weight: 560; }
  .mix-empty-state span { max-width: 210px; color: rgba(255, 255, 255, 0.36); font-size: 0.64rem; line-height: 1.45; }

  .settings-action {
    position: relative;
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 9px 13px;
    border: 1px solid rgba(var(--accent-rgb), 0.34);
    border-radius: 999px;
    color: #121416;
    background: rgba(var(--accent-rgb), 0.9);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.38), 0 6px 20px rgba(var(--accent-rgb), 0.1);
    cursor: pointer;
    font-size: 0.7rem;
    font-weight: 650;
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), filter 180ms ease, box-shadow 220ms ease;
  }

  .settings-action:hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 9px 26px rgba(var(--accent-rgb), 0.16); }
  .settings-action:active { transform: scale(0.97); }

  .settings-backdrop {
    position: fixed;
    z-index: 80;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    overflow: hidden;
    background: rgba(3, 5, 7, 0.45);
    backdrop-filter: blur(16px) saturate(115%);
    -webkit-backdrop-filter: blur(16px) saturate(115%);
    overscroll-behavior: none;
    animation: settings-backdrop-in 220ms ease both;
  }

  .settings-modal {
    width: min(900px, 100%);
    height: min(720px, calc(100svh - 48px));
    height: min(720px, calc(100dvh - 48px));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 34px;
    color: #f7f7f4;
    background:
      radial-gradient(circle at 12% 0%, rgba(var(--accent-rgb), 0.13), transparent 42%),
      linear-gradient(145deg, rgba(35, 39, 42, 0.86), rgba(10, 12, 14, 0.78));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.13), 0 36px 120px rgba(0, 0, 0, 0.58), 0 0 80px rgba(var(--accent-rgb), 0.08);
    backdrop-filter: blur(34px) saturate(150%);
    -webkit-backdrop-filter: blur(34px) saturate(150%);
    animation: settings-modal-in 360ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes settings-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes settings-modal-in { from { opacity: 0; transform: translateY(18px) scale(0.975); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 26px 28px 22px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.09);
  }

  .settings-header h2 { margin: 0; font-size: clamp(1.55rem, 3vw, 2.2rem); font-weight: 450; letter-spacing: -0.045em; }
  .settings-close {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.68);
    background: rgba(16, 19, 21, 0.5);
    cursor: pointer;
    transition: transform 220ms ease, color 180ms ease, background 180ms ease;
  }
  .settings-close:hover { transform: rotate(5deg) scale(1.05); color: #fff; background: rgba(255, 255, 255, 0.1); }
  .settings-close svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }

  .settings-layout { min-height: 0; display: grid; grid-template-columns: 190px minmax(0, 1fr); overflow: hidden; }
  .settings-tabs { display: grid; align-content: start; gap: 6px; padding: 20px 14px 22px 20px; border-right: 1px solid rgba(255, 255, 255, 0.08); }
  .settings-tabs button {
    min-height: 46px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 13px;
    border: 1px solid transparent;
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.5);
    background: transparent;
    cursor: pointer;
    font-size: 0.75rem;
    text-align: left;
    transition: color 180ms ease, background 180ms ease, border-color 180ms ease, transform 220ms ease;
  }
  .settings-tabs button:hover { color: #fff; transform: translateX(2px); background: rgba(255, 255, 255, 0.055); }
  .settings-tabs button.active { color: #fff; border-color: rgba(var(--accent-rgb), 0.23); background: rgba(var(--accent-rgb), 0.11); }
  .settings-tabs i { width: 5px; height: 5px; border-radius: 50%; background: transparent; box-shadow: 0 0 0 4px transparent; }
  .settings-tabs button.active i { background: var(--accent); box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.11); }

  .settings-content {
    min-width: 0;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 28px;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    scrollbar-gutter: stable;
  }
  .settings-pane { display: grid; align-content: start; gap: 11px; animation: settings-pane-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes settings-pane-in { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
  .settings-pane-heading { margin-bottom: 9px; }
  .settings-pane-heading h3 { margin: 0; font-size: 1.15rem; font-weight: 520; letter-spacing: -0.025em; }
  .settings-pane-heading p { max-width: 540px; margin: 7px 0 0; color: rgba(255, 255, 255, 0.48); font-size: 0.75rem; line-height: 1.5; }

  .preference-row {
    min-height: 78px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 16px 17px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 19px;
    color: rgba(255, 255, 255, 0.86);
    background: rgba(18, 21, 23, 0.49);
    cursor: pointer;
    text-align: left;
    transition: background 200ms ease, border-color 200ms ease, transform 220ms ease;
  }
  .preference-row:hover { transform: translateY(-1px); border-color: rgba(var(--accent-rgb), 0.26); background: rgba(25, 28, 31, 0.62); }
  .preference-row > span { display: grid; gap: 5px; }
  .preference-row strong { font-size: 0.8rem; font-weight: 560; }
  .preference-row small { color: rgba(255, 255, 255, 0.43); font-size: 0.68rem; line-height: 1.4; }
  .preference-switch { width: 42px; height: 24px; display: flex; align-items: center; flex: 0 0 auto; padding: 3px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 999px; background: rgba(255, 255, 255, 0.08); transition: background 220ms ease, border-color 220ms ease; }
  .preference-switch b { width: 16px; height: 16px; border-radius: 50%; background: rgba(255, 255, 255, 0.72); box-shadow: 0 2px 7px rgba(0, 0, 0, 0.35); transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1), background 220ms ease; }
  .preference-switch.active { border-color: rgba(var(--accent-rgb), 0.42); background: rgba(var(--accent-rgb), 0.62); }
  .preference-switch.active b { transform: translateX(18px); background: #fff; }
  .settings-volume { margin-top: 6px; background: rgba(18, 21, 23, 0.49); }

  .quiet-view-preview {
    position: relative;
    min-height: 190px;
    overflow: hidden;
    display: grid;
    place-items: center;
    margin-bottom: 4px;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 24px;
    background: radial-gradient(circle at center, rgba(var(--accent-rgb), 0.16), transparent 35%), rgba(8, 10, 12, 0.62);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  .preview-logo { position: absolute; top: 14px; left: 14px; width: 26px; height: 26px; overflow: hidden; border-radius: 8px; }
  .preview-logo img { width: 100%; height: 100%; object-fit: cover; }
  .preview-visualizer,
  .immersive-bars { display: flex; align-items: center; justify-content: center; gap: 5px; }
  .preview-visualizer i { width: 3px; border-radius: 999px; background: var(--accent); box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.22); }
  .settings-note { display: flex; align-items: center; gap: 13px; padding: 14px 15px; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 17px; background: rgba(18, 21, 23, 0.48); }
  .settings-note-icon { width: 38px; height: 38px; display: grid; place-items: center; flex: 0 0 auto; border: 1px solid rgba(var(--accent-rgb), 0.28); border-radius: 12px; color: var(--accent); background: rgba(var(--accent-rgb), 0.09); }
  .settings-note-icon svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
  .settings-note > span:last-child { display: grid; gap: 4px; }
  .settings-note strong { font-size: 0.75rem; font-weight: 560; }
  .settings-note small { color: rgba(255, 255, 255, 0.42); font-size: 0.67rem; line-height: 1.45; }
  .settings-action { justify-self: start; min-width: 150px; margin-top: 3px; }
  .settings-action.secondary { color: rgba(255, 255, 255, 0.8); border-color: rgba(255, 255, 255, 0.13); background: rgba(255, 255, 255, 0.07); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07); }
  .settings-action:disabled { opacity: 0.36; cursor: not-allowed; transform: none; filter: none; }
  .preference-choice-list { display: grid; gap: 8px; }
  .preference-choice-list button {
    min-height: 62px;
    display: grid;
    grid-template-columns: 12px minmax(0, 1fr);
    align-items: center;
    gap: 13px;
    padding: 12px 15px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 17px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(18, 21, 23, 0.46);
    cursor: pointer;
    text-align: left;
    transition: color 180ms ease, background 180ms ease, border-color 180ms ease, transform 220ms ease;
  }
  .preference-choice-list button:hover { color: #fff; transform: translateX(2px); background: rgba(255, 255, 255, 0.065); }
  .preference-choice-list button.active { color: #fff; border-color: rgba(var(--accent-rgb), 0.3); background: rgba(var(--accent-rgb), 0.1); }
  .preference-choice-list button > i { width: 9px; height: 9px; border: 1px solid rgba(255, 255, 255, 0.34); border-radius: 50%; }
  .preference-choice-list button.active > i { border-color: var(--accent); background: var(--accent); box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.11); }
  .preference-choice-list button span { display: grid; gap: 4px; }
  .preference-choice-list strong { font-size: 0.76rem; font-weight: 570; }
  .preference-choice-list small { color: rgba(255, 255, 255, 0.42); font-size: 0.66rem; }

  .weather-mode-choices { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .weather-strength-control { display: grid; gap: 9px; padding: 15px 16px; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 18px; background: rgba(18, 21, 23, 0.46); }
  .weather-strength-control > span { color: rgba(255, 255, 255, 0.72); font-size: 0.72rem; font-weight: 560; }
  .weather-strength-control > div { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
  .weather-strength-control button { min-height: 34px; padding: 7px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 11px; color: rgba(255, 255, 255, 0.46); background: rgba(255, 255, 255, 0.035); cursor: pointer; font-size: 0.63rem; }
  .weather-strength-control button.active { color: #121416; border-color: transparent; background: rgba(var(--accent-rgb), 0.92); }
  .weather-city-form { display: grid; gap: 8px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 18px; background: rgba(18, 21, 23, 0.46); }
  .weather-city-form > label { color: rgba(255, 255, 255, 0.75); font-size: 0.74rem; font-weight: 560; }
  .weather-city-form > div { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; }
  .weather-city-form input { min-width: 0; min-height: 42px; padding: 10px 12px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 13px; outline: 0; color: #fff; background: rgba(8, 11, 13, 0.48); font: inherit; font-size: 0.72rem; }
  .weather-city-form input:focus { border-color: rgba(var(--accent-rgb), 0.46); box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.07); }
  .weather-city-form button { min-width: 88px; padding: 9px 14px; border: 0; border-radius: 13px; color: #111315; background: rgba(var(--accent-rgb), 0.94); cursor: pointer; font-size: 0.67rem; font-weight: 640; }
  .weather-city-form button:disabled { opacity: 0.42; cursor: not-allowed; }
  .weather-city-form > small { color: rgba(255, 255, 255, 0.36); font-size: 0.61rem; line-height: 1.45; }

  .privacy-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
  .analytics-status { flex: 0 0 auto; padding: 6px 9px; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 999px; color: rgba(255, 255, 255, 0.44); background: rgba(255, 255, 255, 0.045); font-size: 0.61rem; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; }
  .analytics-status.active { color: var(--accent); border-color: rgba(var(--accent-rgb), 0.28); background: rgba(var(--accent-rgb), 0.08); }
  .analytics-choices button { min-height: 70px; }
  .privacy-summary,
  .analytics-setup-note { display: grid; gap: 7px; margin-top: 3px; padding: 16px; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 18px; background: rgba(18, 21, 23, 0.46); }
  .privacy-summary strong,
  .analytics-setup-note strong { font-size: 0.76rem; font-weight: 570; }
  .privacy-summary p,
  .analytics-setup-note p { margin: 0; color: rgba(255, 255, 255, 0.46); font-size: 0.69rem; line-height: 1.55; }
  .privacy-summary > span { color: rgba(var(--accent-rgb), 0.78); font-size: 0.64rem; line-height: 1.45; }
  .analytics-setup-note { border-color: rgba(var(--accent-rgb), 0.18); background: rgba(var(--accent-rgb), 0.055); }
  .analytics-setup-note code { padding: 2px 5px; border-radius: 5px; color: rgba(255, 255, 255, 0.72); background: rgba(255, 255, 255, 0.07); font-size: 0.64rem; }

  .credits-card { display: grid; gap: 8px; padding: 18px; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 20px; background: rgba(18, 21, 23, 0.48); }
  .credits-card > span { margin-bottom: 3px; color: rgba(255, 255, 255, 0.38); font-size: 0.63rem; font-weight: 650; letter-spacing: 0.1em; text-transform: uppercase; }
  .credits-card a { display: flex; align-items: center; justify-content: space-between; padding: 12px 13px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; color: rgba(255, 255, 255, 0.74); background: rgba(255, 255, 255, 0.045); font-size: 0.75rem; text-decoration: none; transition: color 180ms ease, border-color 180ms ease, transform 220ms ease; }
  .credits-card a:hover { color: #fff; transform: translateX(2px); border-color: rgba(var(--accent-rgb), 0.3); }
  .credits-card b { color: var(--accent); font-weight: 450; }

  .hero-title-row {
    display: flex;
    align-items: flex-end;
    gap: clamp(14px, 2vw, 24px);
  }

  .scene-favorite-button {
    width: 48px;
    height: 48px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    margin-bottom: 2px;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.58);
    background: rgba(15, 18, 20, 0.4);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 10px 28px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(18px);
    cursor: pointer;
    transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms ease, border-color 180ms ease, background 180ms ease;
  }

  .scene-favorite-button:hover { transform: translateY(-2px); color: #fff; border-color: rgba(var(--accent-rgb), 0.46); }
  .scene-favorite-button.active { color: #151719; border-color: transparent; background: rgba(var(--accent-rgb), 0.92); }
  .scene-favorite-button svg { width: 21px; height: 21px; fill: transparent; stroke: currentColor; stroke-width: 1.55; stroke-linejoin: round; }
  .scene-favorite-button.active svg { fill: currentColor; }

  .library-tools-toggle {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 10px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.46);
    background: rgba(255, 255, 255, 0.025);
    cursor: pointer;
    font-size: 0.6rem;
    transition: color 180ms ease, border-color 180ms ease, background 180ms ease;
  }
  .library-tools-toggle:hover,
  .library-tools-toggle.active { color: #fff; border-color: rgba(var(--accent-rgb), 0.28); background: rgba(var(--accent-rgb), 0.065); }
  .library-tools-toggle svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; }
  .library-tools { display: grid; margin: -5px 0 12px; }
  .library-result-count { justify-self: end; margin-top: -8px; color: rgba(255, 255, 255, 0.3); font-size: 0.57rem; }

  .library-search-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 10px;
  }

  .scene-search {
    min-width: 0;
    min-height: 44px;
    display: flex;
    align-items: center;
    flex: 1;
    gap: 10px;
    padding: 0 14px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 15px;
    background: rgba(15, 18, 20, 0.56);
    transition: border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
  }

  .scene-search:focus-within { border-color: rgba(var(--accent-rgb), 0.42); background: rgba(23, 26, 28, 0.72); box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.07); }
  .scene-search svg { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: rgba(255, 255, 255, 0.46); stroke-width: 1.7; stroke-linecap: round; }
  .scene-search input { width: 100%; min-width: 0; padding: 11px 0; border: 0; outline: 0; color: #fff; background: transparent; font: inherit; font-size: 0.75rem; }
  .scene-search input::placeholder { color: rgba(255, 255, 255, 0.34); }
  .scene-search input::-webkit-search-cancel-button { display: none; }
  .clear-search { width: 42px; height: 42px; display: grid; place-items: center; flex: 0 0 auto; padding: 0; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; color: rgba(255, 255, 255, 0.62); background: rgba(15, 18, 20, 0.58); cursor: pointer; font-size: 1.1rem; }

  .category-filters {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    margin-bottom: 16px;
    padding: 1px 1px 5px;
    scrollbar-width: none;
  }
  .category-filters::-webkit-scrollbar { display: none; }
  .category-filters button {
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    flex: 0 0 auto;
    padding: 7px 11px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.48);
    background: rgba(17, 20, 22, 0.5);
    cursor: pointer;
    font-size: 0.64rem;
    transition: color 180ms ease, border-color 180ms ease, background 180ms ease, transform 180ms ease;
  }
  .category-filters button:hover { transform: translateY(-1px); color: #fff; }
  .category-filters button.active { color: #111315; border-color: transparent; background: rgba(var(--accent-rgb), 0.9); }

  .live-weather-card {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    margin-bottom: 10px;
    border: 1px solid rgba(255, 255, 255, 0.11);
    border-radius: 20px;
    background:
      radial-gradient(circle at 8% 0%, rgba(var(--accent-rgb), 0.19), transparent 46%),
      linear-gradient(135deg, rgba(28, 32, 34, 0.78), rgba(14, 17, 19, 0.7));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 30px rgba(0, 0, 0, 0.12);
    transition: border-color 220ms ease, transform 280ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms ease;
  }
  .live-weather-card:hover { transform: translateY(-2px); border-color: rgba(var(--accent-rgb), 0.34); }
  .live-weather-card.active { border-color: rgba(var(--accent-rgb), 0.54); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.11), 0 0 34px rgba(var(--accent-rgb), 0.1); }
  .live-weather-card.loading .live-weather-icon { animation: weather-card-pulse 1.2s ease-in-out infinite; }
  @keyframes weather-card-pulse { 50% { opacity: 0.42; transform: scale(0.92); } }
  .live-weather-card-main { min-width: 0; min-height: 74px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 11px; padding: 10px 10px 10px 12px; border: 0; color: #fff; background: transparent; cursor: pointer; text-align: left; }
  .live-weather-icon { width: 40px; height: 40px; display: grid; place-items: center; border: 1px solid rgba(var(--accent-rgb), 0.26); border-radius: 13px; color: var(--accent); background: rgba(var(--accent-rgb), 0.075); transition: transform 220ms ease, opacity 220ms ease; }
  .live-weather-icon svg { width: 24px; height: 24px; overflow: visible; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .weather-card-rain { opacity: 0.7; }
  .live-weather-card-copy { min-width: 0; display: grid; gap: 6px; }
  .live-weather-card-copy > span { display: flex; align-items: center; gap: 8px; }
  .live-weather-card-copy i { padding: 3px 6px; border-radius: 999px; color: #111315; background: rgba(var(--accent-rgb), 0.9); font-size: 0.49rem; font-style: normal; font-weight: 750; letter-spacing: 0.08em; text-transform: uppercase; }
  .live-weather-card-copy strong { font-size: 0.88rem; font-weight: 570; }
  .live-weather-card-copy small { overflow: hidden; color: rgba(255, 255, 255, 0.46); font-size: 0.65rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
  .live-weather-card-action { color: rgba(var(--accent-rgb), 0.9); font-size: 0.62rem; font-weight: 620; }
  .live-weather-card-settings { width: 46px; display: grid; place-items: center; align-self: stretch; margin: 8px 8px 8px 0; padding: 0; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; color: rgba(255, 255, 255, 0.46); background: rgba(255, 255, 255, 0.035); cursor: pointer; }
  .live-weather-card-settings:hover { color: #fff; border-color: rgba(var(--accent-rgb), 0.3); }
  .live-weather-card-settings svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.45; stroke-linecap: round; stroke-linejoin: round; }

  .sound-category-browser {
    display: grid;
    gap: 10px;
    margin-top: 14px;
    padding: 13px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: 18px;
    background: rgba(10, 13, 15, 0.3);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  }
  .sound-category-heading { display: flex; align-items: end; justify-content: space-between; gap: 14px; padding: 0 2px; }
  .sound-category-heading > div { display: grid; gap: 3px; }
  .sound-category-heading h3 { margin: 0; color: rgba(255, 255, 255, 0.84); font-size: 0.79rem; font-weight: 570; letter-spacing: -0.01em; }
  .sound-category-heading > span { color: rgba(255, 255, 255, 0.38); font-size: 0.61rem; white-space: nowrap; }
  .sound-category-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .sound-category-list button {
    min-width: 0;
    min-height: 65px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 11px;
    padding: 10px 11px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 15px;
    color: rgba(255, 255, 255, 0.62);
    background: rgba(19, 22, 24, 0.58);
    cursor: pointer;
    text-align: left;
    transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), color 180ms ease, border-color 180ms ease, background 180ms ease;
  }
  .sound-category-list button:hover { transform: translateY(-1px); color: #fff; border-color: rgba(var(--accent-rgb), 0.32); }
  .sound-category-list button.active { color: #fff; border-color: rgba(var(--accent-rgb), 0.42); background: rgba(var(--accent-rgb), 0.1); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055), 0 0 22px rgba(var(--accent-rgb), 0.05); }
  .sound-category-icon { width: 37px; height: 37px; display: grid; place-items: center; border: 1px solid rgba(var(--accent-rgb), 0.2); border-radius: 12px; color: var(--accent); background: rgba(var(--accent-rgb), 0.07); }
  .sound-category-icon svg { width: 20px; height: 20px; overflow: visible; fill: none; stroke: currentColor; stroke-width: 1.45; stroke-linecap: round; stroke-linejoin: round; }
  .sound-category-list button.active .sound-category-road { animation: sound-category-road .85s linear infinite; }
  @keyframes sound-category-road { from { stroke-dasharray: 2 2; stroke-dashoffset: 4; } to { stroke-dasharray: 2 2; stroke-dashoffset: 0; } }
  .sound-category-copy { min-width: 0; display: grid; gap: 4px; }
  .sound-category-copy strong { font-size: 0.72rem; font-weight: 570; }
  .sound-category-copy small { overflow: hidden; color: rgba(255, 255, 255, 0.39); font-size: 0.61rem; line-height: 1.35; text-overflow: ellipsis; white-space: nowrap; }
  .sound-category-count { color: rgba(var(--accent-rgb), 0.8); font-size: 0.57rem; font-weight: 620; white-space: nowrap; }
  .sound-category-list button:only-child { grid-column: 1 / -1; }

  .recent-settings-heading button { padding: 0; border: 0; color: rgba(var(--accent-rgb), 0.82); background: transparent; cursor: pointer; font-size: 0.63rem; }

  .scene-state.favorite { width: auto; height: auto; color: rgba(17, 19, 21, 0.56); background: transparent; font-size: 0.72rem; box-shadow: none; }
  .scene-card:not(.active) .scene-state.favorite { color: var(--accent); }

  .mix-action-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
  .mix-action-row button { min-height: 38px; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 8px; border: 1px solid rgba(255, 255, 255, 0.075); border-radius: 13px; color: rgba(255, 255, 255, 0.48); background: rgba(255, 255, 255, 0.025); cursor: pointer; font-size: 0.59rem; transition: transform 200ms ease, color 180ms ease, border-color 180ms ease, background 180ms ease; }
  .mix-action-row button:hover,
  .mix-action-row button.active { transform: translateY(-1px); color: #fff; border-color: rgba(var(--accent-rgb), 0.3); background: rgba(var(--accent-rgb), 0.07); }
  .mix-action-row svg { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }

  .now-mixing-tray { display: grid; gap: 11px; margin-top: 14px; padding: 14px; border: 1px solid rgba(255, 255, 255, 0.075); border-radius: 18px; background: rgba(12, 15, 17, 0.34); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035); }
  .now-mixing-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .now-mixing-heading h3 { margin: 3px 0 0; color: rgba(255, 255, 255, 0.82); font-size: 0.78rem; font-weight: 560; }
  .layer-chip-row { display: flex; gap: 6px; overflow-x: auto; padding: 1px 0 3px; scrollbar-width: none; }
  .layer-chip-row::-webkit-scrollbar { display: none; }
  .layer-chip { min-width: 126px; max-width: 180px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 7px; flex: 1 0 auto; padding: 9px 9px 8px; border: 1px solid rgba(var(--accent-rgb), 0.14); border-radius: 13px; color: rgba(255, 255, 255, 0.72); background: rgba(var(--accent-rgb), 0.055); }
  .layer-chip > svg { width: 14px; height: 14px; grid-row: 1 / 3; fill: none; stroke: var(--accent); stroke-width: 1.45; stroke-linecap: round; }
  .layer-chip > span:nth-of-type(1) { overflow: hidden; font-size: 0.64rem; font-weight: 540; text-overflow: ellipsis; white-space: nowrap; }
  .layer-chip-level { height: 2px; grid-column: 2; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, 0.08); }
  .layer-chip-level i { display: block; height: 100%; border-radius: inherit; background: rgba(var(--accent-rgb), 0.78); }
  .layer-chip > button { width: 24px; height: 24px; grid-column: 3; grid-row: 1 / 3; display: grid; place-items: center; padding: 0; border: 0; border-radius: 8px; color: rgba(255, 255, 255, 0.35); background: transparent; cursor: pointer; font-size: 0.85rem; }
  .layer-chip > button:hover { color: #fff; background: rgba(255, 255, 255, 0.07); }
  .mix-editor { margin-top: 12px; padding: 14px; border: 1px solid rgba(255, 255, 255, 0.075); border-radius: 18px; background: rgba(10, 13, 15, 0.25); }
  .mix-editor-heading { display: flex; justify-content: space-between; gap: 12px; }
  .mix-editor-heading > div { display: grid; gap: 4px; }
  .mix-editor-heading h3 { margin: 0; }
  .mix-editor-heading > div span { color: rgba(255, 255, 255, 0.36); font-size: 0.58rem; }
  .mix-editor-heading > button { align-self: center; min-height: 31px; padding: 6px 9px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 999px; color: rgba(255, 255, 255, 0.42); background: transparent; cursor: pointer; font-size: 0.56rem; }
  .mix-editor-heading > button.active { color: var(--accent); border-color: rgba(var(--accent-rgb), 0.26); background: rgba(var(--accent-rgb), 0.06); }

  .track-item { min-width: 0; overflow: hidden; display: grid; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 15px; background: rgba(15, 18, 20, 0.42); transition: border-color 220ms ease, background 220ms ease, box-shadow 220ms ease; }
  .track-item.active { border-color: rgba(var(--accent-rgb), 0.4); background: rgba(var(--accent-rgb), 0.085); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 0 22px rgba(var(--accent-rgb), 0.045); }
  .track-item .track-card { width: 100%; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .track-item .track-card.active { color: rgba(255, 255, 255, 0.92); border-color: transparent; background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.1), transparent 74%); box-shadow: none; }
  .track-item .track-card.active small { color: rgba(255, 255, 255, 0.43); }
  .layer-volume { display: block; margin: 0 10px 9px; padding: 5px 7px 0; border-top: 1px solid rgba(255, 255, 255, 0.07); color: rgba(255, 255, 255, 0.4); font-size: 0.58rem; }
  .layer-volume input { height: 24px; }
  .layer-volume input::-webkit-slider-runnable-track { height: 5px; }
  .layer-volume input::-webkit-slider-thumb { width: 16px; height: 16px; margin-top: -6px; }
  .layer-volume input::-moz-range-track,
  .layer-volume input::-moz-range-progress { height: 5px; }
  .layer-volume input::-moz-range-thumb { width: 16px; height: 16px; }

  .data-saver-note { margin: -3px 2px 10px; color: rgba(var(--accent-rgb), 0.75); font-size: 0.64rem; line-height: 1.45; }
  .compact-note { margin-top: 2px; }

  .empty-library-state { display: grid; justify-items: center; gap: 6px; padding: 24px 18px; border: 1px dashed rgba(255, 255, 255, 0.12); border-radius: 19px; color: rgba(255, 255, 255, 0.68); text-align: center; }
  .empty-library-state strong { font-size: 0.8rem; font-weight: 560; }
  .empty-library-state span { color: rgba(255, 255, 255, 0.4); font-size: 0.67rem; line-height: 1.45; }
  .empty-library-state button { margin-top: 5px; padding: 8px 12px; border: 1px solid rgba(var(--accent-rgb), 0.28); border-radius: 999px; color: var(--accent); background: rgba(var(--accent-rgb), 0.07); cursor: pointer; font-size: 0.65rem; }
  .scene-empty { margin-top: 8px; }

  .settings-mix-list { display: grid; gap: 7px; }
  .settings-mix-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 7px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 17px; background: rgba(18, 21, 23, 0.48); }
  .settings-mix-load { min-width: 0; padding: 8px 9px; border: 0; color: rgba(255, 255, 255, 0.78); background: transparent; cursor: pointer; text-align: left; }
  .settings-mix-load span { min-width: 0; display: grid; gap: 4px; }
  .settings-mix-load strong { overflow: hidden; font-size: 0.76rem; font-weight: 560; text-overflow: ellipsis; white-space: nowrap; }
  .settings-mix-load small { overflow: hidden; color: rgba(255, 255, 255, 0.38); font-size: 0.62rem; text-overflow: ellipsis; white-space: nowrap; }
  .settings-mix-card > div { display: flex; gap: 4px; }
  .settings-mix-card > div button { width: 33px; height: 33px; display: grid; place-items: center; padding: 0; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 11px; color: rgba(255, 255, 255, 0.42); background: rgba(255, 255, 255, 0.035); cursor: pointer; }
  .settings-mix-card > div button:hover,
  .settings-mix-card > div button.active { color: var(--accent); border-color: rgba(var(--accent-rgb), 0.28); background: rgba(var(--accent-rgb), 0.08); }
  .recent-settings-heading { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 0 2px; }
  .recent-settings-heading strong { color: rgba(255, 255, 255, 0.55); font-size: 0.67rem; font-weight: 620; letter-spacing: 0.06em; text-transform: uppercase; }
  .recent-settings-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
  .recent-settings-list button { min-width: 0; display: grid; gap: 4px; padding: 11px 12px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; color: rgba(255, 255, 255, 0.68); background: rgba(18, 21, 23, 0.42); cursor: pointer; text-align: left; }
  .recent-settings-list strong { font-size: 0.72rem; font-weight: 550; }
  .recent-settings-list span { overflow: hidden; color: rgba(255, 255, 255, 0.36); font-size: 0.59rem; text-overflow: ellipsis; white-space: nowrap; }

  .app-toast { position: fixed; z-index: 120; left: 50%; bottom: 25px; min-height: 42px; display: flex; align-items: center; gap: 9px; padding: 11px 16px; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 999px; color: rgba(255, 255, 255, 0.86); background: rgba(17, 20, 22, 0.84); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 18px 50px rgba(0, 0, 0, 0.35); backdrop-filter: blur(22px) saturate(145%); transform: translateX(-50%); font-size: 0.7rem; animation: toast-in 340ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  .app-toast span { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; background: var(--accent); box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.68); }
  @keyframes toast-in { from { opacity: 0; transform: translate(-50%, 12px) scale(0.96); } to { opacity: 1; transform: translateX(-50%); } }

  .save-mix-backdrop { position: fixed; z-index: 100; inset: 0; display: grid; place-items: center; padding: 22px; background: rgba(3, 5, 7, 0.44); backdrop-filter: blur(15px); animation: settings-backdrop-in 200ms ease both; }
  .save-mix-dialog { width: min(430px, 100%); display: grid; gap: 18px; padding: 24px; border: 1px solid rgba(255, 255, 255, 0.17); border-radius: 27px; color: #f7f7f4; background: radial-gradient(circle at 10% 0%, rgba(var(--accent-rgb), 0.14), transparent 46%), rgba(18, 21, 23, 0.9); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 32px 100px rgba(0, 0, 0, 0.5); backdrop-filter: blur(30px) saturate(150%); animation: settings-modal-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  .save-mix-dialog h2 { margin: 0; font-size: 1.55rem; font-weight: 470; letter-spacing: -0.04em; }
  .save-mix-dialog > div > p:last-child { margin: 8px 0 0; color: rgba(255, 255, 255, 0.45); font-size: 0.69rem; line-height: 1.45; }
  .save-mix-dialog label { display: grid; gap: 7px; color: rgba(255, 255, 255, 0.52); font-size: 0.66rem; }
  .save-mix-dialog input { width: 100%; min-height: 48px; padding: 12px 14px; border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 15px; outline: 0; color: #fff; background: rgba(8, 11, 13, 0.48); font: inherit; }
  .save-mix-dialog input:focus { border-color: rgba(var(--accent-rgb), 0.5); box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.08); }
  .save-mix-actions { display: flex; justify-content: flex-end; gap: 7px; }
  .save-mix-actions button { min-height: 40px; padding: 9px 15px; border: 1px solid rgba(255, 255, 255, 0.11); border-radius: 999px; color: rgba(255, 255, 255, 0.67); background: rgba(255, 255, 255, 0.05); cursor: pointer; }
  .save-mix-actions button.primary { color: #121416; border-color: transparent; background: rgba(var(--accent-rgb), 0.94); font-weight: 620; }

  .immersive-visualizer {
    position: fixed;
    z-index: 4;
    top: 50%;
    left: 50%;
    width: clamp(132px, 15vw, 190px);
    aspect-ratio: 1;
    display: grid;
    place-items: center;
    transform: translate(-50%, -50%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16, 19, 21, 0.26), rgba(10, 12, 14, 0.08) 66%, transparent 69%);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 0 70px rgba(var(--accent-rgb), 0.08);
    backdrop-filter: blur(7px);
    -webkit-backdrop-filter: blur(7px);
    animation: immersive-in 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes immersive-in { from { opacity: 0; transform: translate(-50%, -46%) scale(0.88); filter: blur(10px); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: none; } }
  .immersive-glow { position: absolute; inset: 24%; border-radius: 50%; background: rgba(var(--accent-rgb), 0.16); filter: blur(22px); transition: opacity 300ms ease, transform 300ms ease; }
  .immersive-visualizer.playing .immersive-glow { opacity: 0.85; transform: scale(1.25); animation: immersive-pulse 4s ease-in-out infinite; }
  @keyframes immersive-pulse { 50% { transform: scale(1.55); opacity: 0.58; } }
  .immersive-bars { position: relative; height: 68px; }
  .immersive-bars i { width: 4px; min-height: 7px; border-radius: 999px; background: linear-gradient(to top, rgba(255, 255, 255, 0.48), var(--accent)); box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.2); transition: height 70ms linear, opacity 140ms ease; }

  @media (min-width: 1121px) {
    .library-panel {
      position: sticky;
      top: 80px;
      align-self: start;
      max-height: calc(100svh - 98px);
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(var(--accent-rgb), 0.3) transparent;
    }
  }

  @media (max-width: 1120px) {
    .workspace { grid-template-columns: 1fr; }
    .mixer-panel { order: -1; }
    .scene-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }

  @media (max-width: 760px) {
    .topbar { padding: 18px 16px; }
    .wordmark-copy { display: none; }
    .video-toggle span,
    .pip-toggle span,
    .settings-button span { display: none; }
    .topbar-actions { gap: 7px; }
    .video-toggle,
    .pip-toggle,
    .settings-button { width: 42px; height: 42px; justify-content: center; padding: 0; }
    .pip-consent { left: 12px; right: 12px; bottom: 12px; width: auto; padding: 16px; border-radius: 23px; }
    .pip-consent-actions { display: grid; grid-template-columns: 1fr 1fr; }
    .pip-consent-actions .pip-primary { grid-column: 1 / -1; }
    .pip-consent-actions button { width: 100%; }
    .analytics-consent { bottom: 12px; width: calc(100vw - 24px); padding: 16px; border-radius: 23px; }
    .analytics-consent-actions { display: grid; grid-template-columns: 1fr 1fr; }
    .analytics-consent-actions .analytics-allow { grid-column: 1 / -1; }
    .analytics-consent-actions button { width: 100%; }
    main { padding: 88px 12px 28px; }
    .scene-hero { min-height: 140px; display: block; margin: 0 8px 24px; }
    .live-weather-hero { min-height: 0; display: grid; grid-template-columns: 1fr; gap: 24px; padding-top: 28px; }
    .weather-hero-reading { align-items: center; gap: 18px; }
    .weather-hero-reading > strong { font-size: clamp(5.3rem, 25vw, 7.5rem); }
    .weather-hero-reading b { font-size: clamp(1.2rem, 6vw, 1.75rem); }
    .weather-hero-reading small { line-height: 1.4; }
    .weather-hero-side { gap: 13px; }
    .weather-hero-side dl { padding-top: 12px; }
    h1 { font-size: clamp(4rem, 21vw, 6.3rem); }
    .hero-title-row { align-items: center; }
    .scene-favorite-button { width: 43px; height: 43px; margin: 7px 0 0; border-radius: 14px; }
    .scene-hero > p { width: min(100%, 420px); margin-top: 22px; font-size: 0.9rem; }
    .liquid-panel { border-radius: 26px; }
    .library-panel, .mixer-panel { padding: 18px; }
    .recommendation-panel { --mix-panel-pad: 18px; padding: var(--mix-panel-pad); }
    .mixer-panel { display: block; }
    .mixer-panel { order: -2; }
    .library-panel { order: -1; }
    .scene-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: none;
      grid-auto-flow: row;
      gap: 8px;
      overflow: visible;
      padding: 0;
    }
    .scene-grid:not(.expanded) .scene-card:nth-child(n+9):not(.active) { display: none; }
    .track-grid, .video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mix-action-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .scene-card { min-height: 86px; padding: 12px; gap: 10px; border-radius: 18px; }
    .scene-card.active { grid-column: 1 / -1; min-height: 92px; }
    .scene-card small { display: block; font-size: 0.61rem; }
    .scene-card strong { font-size: 0.79rem; }
    .live-weather-card-main { min-height: 82px; grid-template-columns: auto minmax(0, 1fr); gap: 11px; padding: 12px; }
    .live-weather-card-action { display: none; }
    .live-weather-card-copy small { white-space: normal; }
    .live-weather-icon { width: 42px; height: 42px; border-radius: 14px; }
    .mobile-library-more {
      width: 100%;
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 9px;
      border: 1px solid rgba(255, 255, 255, 0.075);
      border-radius: 15px;
      color: rgba(255, 255, 255, 0.62);
      background: rgba(255, 255, 255, 0.035);
      cursor: pointer;
      font-size: 0.66rem;
      font-weight: 560;
    }
    .mobile-library-more svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; transition: transform 260ms ease; }
    .mobile-library-more svg.expanded { transform: rotate(180deg); }
    .audio-button { width: 74px; height: 74px; }
    .audio-button-core { width: 54px; height: 54px; }
    .track-card:last-child:nth-child(odd) { grid-column: auto; }
    .quiet-view-button { left: 16px; bottom: 16px; width: 46px; height: 46px; border-radius: 15px; }
    .recipe-drawer { top: auto; right: 0; bottom: 0; width: 100%; padding: 0 10px 10px; transform: translateY(0); }
    .recipe-drawer.closed { transform: translateY(100%); }
    .recipe-drawer-handle { top: -62px; right: 16px; left: auto; width: 104px; height: 44px; border-color: rgba(255, 255, 255, 0.14); border-radius: 16px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), 0 12px 28px rgba(0, 0, 0, 0.28), 0 0 24px rgba(var(--accent-rgb), 0.08); }
    .recipe-drawer-handle svg { transform: rotate(90deg); }
    .recipe-drawer.closed .recipe-drawer-handle svg { transform: rotate(-90deg); }
    .recommendation-panel { max-height: min(72svh, 650px); border-radius: 28px; }
    .recipe-list,
    .mix-personal-list { grid-template-columns: 1fr; gap: 8px; }
    .settings-backdrop { align-items: end; padding: 0; }
    .settings-modal { width: 100%; height: calc(100svh - 18px); height: calc(100dvh - 18px); border-radius: 28px 28px 0 0; }
    .settings-header { padding: 21px 19px 17px; }
    .settings-layout { min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); grid-template-columns: 1fr; overflow: hidden; }
    .settings-tabs { position: relative; z-index: 2; grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; padding: 12px 14px; border-right: 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(15, 18, 20, 0.82); backdrop-filter: blur(22px); overscroll-behavior-x: contain; touch-action: pan-x; scrollbar-width: none; }
    .settings-tabs::-webkit-scrollbar { display: none; }
    .settings-tabs button { min-height: 40px; padding: 9px 12px; }
    .settings-tabs button:hover { transform: none; }
    .settings-content { overflow-x: hidden; overflow-y: auto; padding: 20px 17px 28px; }
    .weather-mode-choices { grid-template-columns: 1fr; }
    .recent-settings-list { grid-template-columns: 1fr; }
    .preference-row { min-height: 74px; gap: 14px; padding: 14px; }
    .quiet-view-preview { min-height: 160px; }
    .immersive-visualizer { width: 142px; }
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
    .track-item:last-child:nth-child(odd) { grid-column: auto; }
    .mix-action-row button { padding-inline: 8px; }
    .sound-category-browser { padding: 11px; }
    .sound-category-list { grid-template-columns: 1fr; }
    .sound-category-count { display: none; }
    .sound-category-copy small { white-space: normal; }
    .app-toast { bottom: 14px; width: max-content; max-width: calc(100vw - 28px); justify-content: center; text-align: center; }
    .video-card strong { font-size: 0.72rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
</style>
