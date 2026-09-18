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
  import { scenes } from "./sceneLibrary";
  import { siteUrl } from "./siteUrl.mjs";

  let audioElements = [];
  let backgroundComponent;
  let activeIndex = 0;
  let selectedAudio = 0;
  let selectedAudios = [0];
  let selectedVideo = 0;
  let audioStarted = false;
  let isAudioPlaying = false;
  let isVideoPlaying = true;
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
  let settingsOpen = false;
  let settingsTab = "playback";
  let linkedPlayback = true;
  let multiSoundEnabled = false;
  let immersiveMode = false;
  let recipesOpen = true;
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
  let saveMixOpen = false;
  let saveMixName = "";
  let toastMessage = "";
  let toastTimer;
  let persistenceTimer;
  let hydrated = false;

  const preferencesStorageKey = "atmosphere-preferences-v2";
  const legacyPreferencesStorageKey = "atmosphere-preferences-v1";
  const savedMixesStorageKey = "atmosphere-saved-mixes-v1";
  const recentMixesStorageKey = "atmosphere-recent-mixes-v1";
  const favoriteScenesStorageKey = "atmosphere-favorite-scenes-v1";
  const resumeStorageKey = "atmosphere-resume-v1";
  const audioCrossfadeMilliseconds = 760;
  const smartMixIntervalMilliseconds = 12000;
  const nativeVolumeFrames = new WeakMap();
  const settingsTabs = [
    { id: "playback", title: "Playback" },
    { id: "mixes", title: "My mixes" },
    { id: "display", title: "Display" },
    { id: "mini-player", title: "Mini player" },
    { id: "privacy", title: "Privacy" },
    { id: "about", title: "About" },
  ];
  const recipeBlueprints = [
    { id: "office-focus", title: "Office focus", detail: "A steady foundation with just enough natural detail to stay attentive.", indices: [0, 2] },
    { id: "gentle-depth", title: "Gentle depth", detail: "A softer two-layer blend for reading, journaling, and unwinding.", indices: [1, 4] },
    { id: "full-atmosphere", title: "Full atmosphere", detail: "A richer three-part soundscape that fills the room without feeling busy.", indices: [0, 2, 3] },
  ];

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
  $: selectedTrackNames = selectedAudios.map((index) => activeScene.audioTracks[index]?.title).filter(Boolean);
  $: mixTitle = selectedAudios.length > 1 ? `${selectedAudios.length} sounds mixed` : activeTrack.title;
  $: mixNote = selectedAudios.length > 1 ? selectedTrackNames.join(" + ") : `${activeTrack.note} · recorded ambience`;
  $: soundRecipes = recipeBlueprints.map((recipe) => ({
    ...recipe,
    tracks: recipe.indices.map((index) => activeScene.audioTracks[index]).filter(Boolean),
  }));
  $: sceneCategories = ["all", "favorites", ...new Set(scenes.map((scene) => scene.category))];
  $: filteredScenes = filterSceneLibrary(scenes, libraryQuery, libraryCategory, favoriteSceneIds);
  $: currentSceneFavorite = favoriteSceneIds.includes(activeScene.id);
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
    poster: siteUrl(`assets/videos/${activeVideo.poster}`),
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
    else stopVisualizer();
  }

  function pauseAllAudio() {
    audioElements.filter(Boolean).forEach((element) => element.pause());
    isAudioPlaying = false;
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
      if (pipPreference === "ask") pipPromptVisible = true;
    } else {
      isAudioPlaying = false;
      audioLoading = false;
      audioError = "Audio could not start";
    }
  }

  async function togglePlayback() {
    if (isAudioPlaying) {
      await fadeAndPauseAllAudio();
      if (linkedPlayback) isVideoPlaying = false;
      trackEvent("playback_pause", { control_source: "main_transport", video_linked: linkedPlayback });
      return;
    }
    if (linkedPlayback) isVideoPlaying = !dataSaverMode;
    await playSelectedTracks(selectedAudios, "main_transport");
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

  async function selectScene(index) {
    const continuePlaying = isAudioPlaying;
    const previousScene = activeScene;
    if (continuePlaying) await fadeAndPauseAllAudio(audioCrossfadeMilliseconds / 2);
    else pauseAllAudio();
    activeIndex = index;
    selectedAudio = 0;
    selectedAudios = [0];
    selectedVideo = 0;
    isVideoPlaying = !dataSaverMode;
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
    });
    await tick();
    if (continuePlaying) {
      await playSelectedTracks([0], "atmosphere_change");
    }
    queuePersistSession();
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

  async function applyRecipe(recipe) {
    multiSoundEnabled = true;
    selectedAudios = recipe.indices.filter((index) => activeScene.audioTracks[index]);
    selectedAudio = selectedAudios[0];
    selectedAudios.forEach((index, position) => {
      const trackId = getTrackId(index);
      if (trackId && !Number.isFinite(Number(layerVolumes[trackId]))) {
        layerVolumes = { ...layerVolumes, [trackId]: position === 0 ? 0.74 : 0.62 };
      }
    });
    isVideoPlaying = !dataSaverMode;
    savePreferences();
    trackEvent("sound_recipe_apply", {
      recipe_id: recipe.id,
      recipe_title: recipe.title,
      recipe_track_ids: selectedAudios.map((index) => activeScene.audioTracks[index]?.id).filter(Boolean).join(","),
    });
    await playSelectedTracks(selectedAudios, "sound_recipe");
  }

  function selectVideo(index) {
    selectedVideo = index;
    isVideoPlaying = !dataSaverMode;
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
    isVideoPlaying = enabled ? false : true;
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
    isVideoPlaying = !dataSaverMode;
    smartMixMultipliers = {};
    applyVolume(0);
    savePreferences();
    queuePersistSession();
    refreshSmartMixSchedule();
    if (continuePlaying) await playSelectedTracks(selectedAudios, source);
    const sourceLabel = source === "shared_mix" ? "Shared mix" : source === "recent_mix" ? "Recent session" : source === "resume" ? "Last session" : "Saved mix";
    showToast(`${sourceLabel} loaded · press play when ready`);
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
    return category;
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

  function openSettings(tab = "playback") {
    settingsTab = tab;
    settingsOpen = true;
    trackEvent("settings_open", { settings_tab: tab });
  }

  function closeSettings() {
    settingsOpen = false;
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
    isVideoPlaying = !isVideoPlaying;
    trackEvent(isVideoPlaying ? "video_play" : "video_pause", { control_source: "separate_video_control" });
  }

  function handleSettingsBackdrop(event) {
    if (event.target === event.currentTarget) closeSettings();
  }

  function enterImmersiveMode() {
    settingsOpen = false;
    immersiveMode = true;
    trackEvent("quiet_view_enter", { audio_playing: isAudioPlaying });
  }

  function exitImmersiveMode() {
    immersiveMode = false;
    trackEvent("quiet_view_exit", { audio_playing: isAudioPlaying });
  }

  function toggleRecipes() {
    recipesOpen = !recipesOpen;
    localStorage.setItem("atmosphere-recipes-open", String(recipesOpen));
    trackEvent(recipesOpen ? "sound_recipes_open" : "sound_recipes_close");
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
    const savedPreferences = readStoredJson(
      preferencesStorageKey,
      readStoredJson(legacyPreferencesStorageKey, {}),
    );
    if (typeof savedPreferences.linkedPlayback === "boolean") linkedPlayback = savedPreferences.linkedPlayback;
    if (typeof savedPreferences.multiSoundEnabled === "boolean") multiSoundEnabled = savedPreferences.multiSoundEnabled;
    if (typeof savedPreferences.smartMixEnabled === "boolean") smartMixEnabled = savedPreferences.smartMixEnabled;
    if (typeof savedPreferences.dataSaverMode === "boolean") dataSaverMode = savedPreferences.dataSaverMode;
    if (Number.isFinite(Number(savedPreferences.volume))) volume = Math.max(0, Math.min(1, Number(savedPreferences.volume)));
    savedMixes = sortSavedMixes(readStoredJson(savedMixesStorageKey, []), scenes);
    recentMixes = readStoredJson(recentMixesStorageKey, [])
      .map((mix) => normalizeMixSnapshot(mix, scenes))
      .filter(Boolean)
      .slice(0, 6);
    favoriteSceneIds = readStoredJson(favoriteScenesStorageKey, [])
      .filter((sceneId) => scenes.some((scene) => scene.id === sceneId));
    const firstTrackId = getTrackId(0);
    if (firstTrackId) layerVolumes = { [firstTrackId]: 1 };
    const savedRecipesOpen = localStorage.getItem("atmosphere-recipes-open");
    recipesOpen = savedRecipesOpen === null ? window.innerWidth > 760 : savedRecipesOpen === "true";
    initializeAnalytics(getAnalyticsContext);
    const analyticsStatus = getAnalyticsStatus();
    analyticsConfigured = analyticsStatus.configured;
    analyticsConsent = analyticsStatus.consent;
    trackEvent("atmosphere_view", { view_source: "initial_load" });
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
    hydrated = true;

    const sharedMix = decodeMixSnapshot(new URL(window.location.href).searchParams.get("mix"), scenes);
    const resumeMix = normalizeMixSnapshot(readStoredJson(resumeStorageKey, null), scenes);
    if (sharedMix) {
      applyMixSnapshot(sharedMix, "shared_mix");
    } else if (resumeMix) {
      applyMixSnapshot(resumeMix, "resume");
    } else {
      dataSaverMode = Boolean(savedPreferences.dataSaverMode);
      isVideoPlaying = !dataSaverMode;
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
    <AmbientStatus immersive={immersiveMode} />
    {#if !immersiveMode}
      <div class="topbar-actions">
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

  {#if pipPromptVisible && !immersiveMode}
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
            {#each settingsTabs as tab}
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
                  <span><strong>Unified play and pause</strong><small>Control the video loop and every active sound with the main button.</small></span>
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
            {:else if settingsTab === "mini-player"}
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
                  <span>Media attribution</span>
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
  <main class:recipes-visible={recipesOpen}>
    {#key activeScene.id}
      <section class="scene-hero">
        <div>
          <p class="eyebrow">{activeScene.category} · Scene {String(activeIndex + 1).padStart(2, "0")}</p>
          <div class="hero-title-row">
            <h1>{activeScene.title}</h1>
            <button class:active={currentSceneFavorite} class="scene-favorite-button" type="button" aria-pressed={currentSceneFavorite} aria-label={currentSceneFavorite ? `Remove ${activeScene.title} from favorites` : `Add ${activeScene.title} to favorites`} title={currentSceneFavorite ? "Remove favorite" : "Favorite atmosphere"} on:click={toggleCurrentSceneFavorite}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.45 6.02.88-4.36 4.25 1.03 6-5.39-2.83-5.39 2.83 1.03-6-4.36-4.25 6.02-.88L12 3Z" /></svg>
            </button>
          </div>
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
          <span>{filteredScenes.length} of {scenes.length}</span>
        </div>

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

        {#if savedMixes.length || recentMixes.length}
          <div class="personal-library">
            {#if savedMixes.length}
              <section aria-labelledby="saved-mixes-heading">
                <div class="personal-heading"><h3 id="saved-mixes-heading">Saved mixes</h3><button type="button" on:click={() => openSettings("mixes")}>Manage</button></div>
                <div class="personal-card-row">
                  {#each savedMixes.slice(0, 5) as mix (mix.id)}
                    <article class="personal-mix-card">
                      <button class="personal-mix-load" type="button" on:click={() => applyMixSnapshot(mix)}>
                        <strong>{mix.name || getMixScene(mix).title}</strong>
                        <span>{getMixDescription(mix)}</span>
                      </button>
                      <div>
                        <button class:active={mix.favorite} type="button" aria-label={mix.favorite ? "Remove favorite mix" : "Favorite mix"} on:click={() => toggleSavedMixFavorite(mix.id)}>★</button>
                        <button type="button" aria-label={`Share ${mix.name || "mix"}`} on:click={() => shareMix(mix)}>↗</button>
                      </div>
                    </article>
                  {/each}
                </div>
              </section>
            {/if}
            {#if recentMixes.length}
              <section aria-labelledby="recent-mixes-heading">
                <div class="personal-heading"><h3 id="recent-mixes-heading">Recently played</h3><button type="button" on:click={clearRecentMixes}>Clear</button></div>
                <div class="recent-card-row">
                  {#each recentMixes.slice(0, 5) as mix}
                    <button type="button" on:click={() => applyMixSnapshot(mix, "recent_mix")}>
                      <strong>{getMixScene(mix).title}</strong><span>{getMixTrackNames(mix).join(" + ")}</span>
                    </button>
                  {/each}
                </div>
              </section>
            {/if}
          </div>
        {/if}

        {#if filteredScenes.length}
        <div class="scene-grid">
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
        {:else}
          <div class="empty-library-state scene-empty"><strong>No atmosphere matches that search</strong><span>Try a broader sound, mood, or category.</span><button type="button" on:click={() => { libraryQuery = ""; libraryCategory = "all"; }}>Show everything</button></div>
        {/if}
      </section>

      <section class="mixer-panel liquid-panel" aria-labelledby="mixer-heading">
        <div class="section-heading mixer-heading">
          <div>
            <p class="kicker">Sound</p>
            <h2 id="mixer-heading">{mixTitle}</h2>
          </div>
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

        <div class="mix-action-row" aria-label="Mix actions">
          <button type="button" on:click={openSaveMix}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h12l2 2V20H5V4.5Z" /><path d="M8 4.5v5h8v-5M8.5 20v-6h7v6" /></svg>
            <span>Save mix</span>
          </button>
          <button type="button" on:click={() => shareMix()}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.4" /><circle cx="6" cy="12" r="2.4" /><circle cx="18" cy="19" r="2.4" /><path d="m8.1 10.8 7.8-4.6M8.1 13.2l7.8 4.6" /></svg>
            <span>Share</span>
          </button>
          <button class:active={smartMixEnabled} type="button" aria-pressed={smartMixEnabled} on:click={() => setSmartMixEnabled(!smartMixEnabled)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13.2 2.8-7 10h5l-.7 8.4 7.3-11h-5l.4-7.4Z" /></svg>
            <span>Smart Mix</span>
          </button>
          <button class:active={dataSaverMode} type="button" aria-pressed={dataSaverMode} on:click={() => setDataSaverMode(!dataSaverMode)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5c4.8-4 11.2-4 16 0M7 12c3.1-2.4 6.9-2.4 10 0M10 15.5c1.3-.9 2.7-.9 4 0" /><path d="m4 4 16 16" /></svg>
            <span>Audio only</span>
          </button>
        </div>

        <div class="option-section">
          <div class="option-heading">
            <h3>Audio layers</h3>
            <span>{multiSoundEnabled ? `${selectedAudios.length} active · layering on` : "Single sound"}</span>
          </div>
          {#key activeScene.id}
            <div class="track-grid option-grid-enter">
              {#each activeScene.audioTracks as track, index (track.id)}
                <article class:active={selectedAudios.includes(index)} class="track-item">
                  <button
                    type="button"
                    class="track-card"
                    class:active={selectedAudios.includes(index)}
                    aria-pressed={selectedAudios.includes(index)}
                    on:click={() => selectTrack(index)}
                  >
                    <span class="track-number">0{index + 1}</span>
                    <span><strong>{track.title}</strong><small>{track.note}</small></span>
                  </button>
                  {#if selectedAudios.includes(index)}
                    <label class="layer-volume">
                      <span>Layer</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={layerVolumes[track.id] ?? 1}
                        style={`--volume-percent: ${Math.round((layerVolumes[track.id] ?? 1) * 100)}%`}
                        aria-label={`${track.title} layer volume`}
                        aria-valuetext={`${Math.round((layerVolumes[track.id] ?? 1) * 100)} percent`}
                        on:input={(event) => updateLayerVolume(index, event)}
                        on:change={() => commitLayerVolume(index)}
                      />
                      <output>{Math.round((layerVolumes[track.id] ?? 1) * 100)}</output>
                    </label>
                  {/if}
                </article>
              {/each}
            </div>
          {/key}
        </div>

        <div class="option-section video-section">
          <div class="option-heading">
            <h3>Video loops</h3>
            <span>{dataSaverMode ? "Audio only" : `${activeScene.videoLoops.length} views`}</span>
          </div>
          {#if dataSaverMode}<p class="data-saver-note">Video downloads are paused. Choose a view now and it will appear when Audio only is turned off.</p>{/if}
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

  <aside class:closed={!recipesOpen} class="recipe-drawer" aria-labelledby="recommendation-heading">
    <button class="recipe-drawer-handle" type="button" aria-expanded={recipesOpen} aria-controls="sound-recipe-panel" aria-label={recipesOpen ? "Hide sound recipes" : "Show sound recipes"} title={recipesOpen ? "Hide sound recipes" : "Show sound recipes"} on:click={toggleRecipes}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      <i aria-hidden="true"></i>
    </button>
    <div id="sound-recipe-panel" class="recommendation-panel liquid-panel" aria-hidden={!recipesOpen} inert={!recipesOpen}>
      <div class="section-heading recommendation-heading">
        <div>
          <p class="kicker">Sound recipes</p>
          <h2 id="recommendation-heading">Recommended mixes</h2>
        </div>
        <span>{activeScene.title}</span>
      </div>
      <p class="recommendation-intro">Layer recordings from this atmosphere for a little more texture.</p>
      <div class="recipe-list">
        {#each soundRecipes as recipe}
          <article class="recipe-card">
            <p>For {recipe.title.toLowerCase()}, combine</p>
            <h3>{recipe.tracks.map((track) => track.title).join(" + ")}</h3>
            <span>{recipe.detail}</span>
            <button type="button" on:click={() => applyRecipe(recipe)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6V6Z" /></svg>
              Try mix
            </button>
          </article>
        {/each}
      </div>
      <p class="recipe-tip">Turn layering off in Settings to return to one sound at a time.</p>
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

  .track-item:last-child:nth-child(odd) { grid-column: 1 / -1; }

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

  .recipe-drawer {
    position: fixed;
    z-index: 18;
    top: 108px;
    right: 18px;
    width: clamp(278px, 21vw, 308px);
    transform: translateX(0);
    transition: transform 560ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .recipe-drawer.closed { transform: translateX(calc(100% + 18px)); }

  .recipe-drawer-handle {
    position: absolute;
    z-index: 2;
    top: 34px;
    left: -46px;
    width: 47px;
    height: 62px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.17);
    border-right-color: rgba(255, 255, 255, 0.07);
    border-radius: 18px 0 0 18px;
    color: rgba(255, 255, 255, 0.8);
    background: rgba(18, 21, 23, 0.58);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), -9px 12px 30px rgba(0, 0, 0, 0.2), 0 0 24px rgba(var(--accent-rgb), 0.07);
    backdrop-filter: blur(22px) saturate(145%);
    -webkit-backdrop-filter: blur(22px) saturate(145%);
    cursor: pointer;
    transition: color 200ms ease, background 200ms ease, border-color 200ms ease;
  }

  .recipe-drawer-handle:hover { color: #fff; border-color: rgba(var(--accent-rgb), 0.42); background: rgba(29, 33, 36, 0.7); }
  .recipe-drawer-handle svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: transform 480ms cubic-bezier(0.16, 1, 0.3, 1); }
  .recipe-drawer.closed .recipe-drawer-handle svg { transform: rotate(180deg); }
  .recipe-drawer-handle i { position: absolute; bottom: 9px; width: 4px; height: 4px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 9px rgba(var(--accent-rgb), 0.72); }

  .recommendation-panel {
    width: 100%;
    max-height: calc(100svh - 132px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(var(--accent-rgb), 0.34) transparent;
  }

  .recommendation-heading { display: grid; gap: 8px; }
  .recommendation-heading > span { white-space: normal; line-height: 1.35; }

  .recommendation-intro,
  .recipe-tip {
    margin: -7px 0 18px;
    color: rgba(255, 255, 255, 0.48);
    font-size: 0.72rem;
    line-height: 1.55;
  }

  .recipe-list { display: grid; gap: 9px; }

  .recipe-card {
    position: relative;
    overflow: hidden;
    display: grid;
    gap: 8px;
    padding: 16px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 19px;
    background: rgba(21, 24, 26, 0.62);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055);
    transition: border-color 240ms ease, background 240ms ease, transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .recipe-card::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.46;
    background: radial-gradient(circle at 0 0, rgba(var(--accent-rgb), 0.13), transparent 54%);
  }

  .recipe-card:hover { transform: translateY(-2px); border-color: rgba(var(--accent-rgb), 0.3); background: rgba(28, 31, 33, 0.72); }
  .recipe-card p,
  .recipe-card h3,
  .recipe-card > span { position: relative; margin: 0; }
  .recipe-card p { color: rgba(var(--accent-rgb), 0.85); font-size: 0.62rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; }
  .recipe-card h3 { color: rgba(255, 255, 255, 0.86); font-size: 0.8rem; font-weight: 560; line-height: 1.35; }
  .recipe-card > span { min-height: 44px; color: rgba(255, 255, 255, 0.43); font-size: 0.67rem; line-height: 1.48; }

  .recipe-card button,
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

  .recipe-card button:hover,
  .settings-action:hover { transform: translateY(-1px); filter: brightness(1.08); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 9px 26px rgba(var(--accent-rgb), 0.16); }
  .recipe-card button:active,
  .settings-action:active { transform: scale(0.97); }
  .recipe-card button svg { width: 13px; height: 13px; fill: currentColor; stroke: none; }
  .recipe-tip { margin: 15px 2px 0; }

  .settings-backdrop {
    position: fixed;
    z-index: 80;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    background: rgba(3, 5, 7, 0.45);
    backdrop-filter: blur(16px) saturate(115%);
    -webkit-backdrop-filter: blur(16px) saturate(115%);
    animation: settings-backdrop-in 220ms ease both;
  }

  .settings-modal {
    width: min(900px, 100%);
    max-height: min(720px, calc(100svh - 48px));
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

  .settings-layout { min-height: 445px; display: grid; grid-template-columns: 190px minmax(0, 1fr); }
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

  .settings-content { min-width: 0; overflow: auto; padding: 28px; }
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

  .library-search-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 7px;
    margin: -4px 0 10px;
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

  .personal-library {
    display: grid;
    gap: 16px;
    margin: 3px 0 18px;
    padding: 15px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 21px;
    background: rgba(12, 15, 17, 0.3);
  }
  .personal-library section { min-width: 0; }
  .personal-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 2px 8px; }
  .personal-heading h3 { margin: 0; color: rgba(255, 255, 255, 0.68); font-size: 0.68rem; font-weight: 620; letter-spacing: 0.05em; text-transform: uppercase; }
  .personal-heading button,
  .recent-settings-heading button { padding: 0; border: 0; color: rgba(var(--accent-rgb), 0.82); background: transparent; cursor: pointer; font-size: 0.63rem; }
  .personal-card-row,
  .recent-card-row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(180px, 0.76fr); gap: 7px; overflow-x: auto; padding-bottom: 3px; scrollbar-width: thin; scrollbar-color: rgba(var(--accent-rgb), 0.24) transparent; }
  .personal-mix-card { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 5px; padding: 6px; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 15px; background: rgba(22, 25, 27, 0.66); }
  .personal-mix-load { min-width: 0; display: grid; gap: 4px; padding: 7px; border: 0; color: rgba(255, 255, 255, 0.78); background: transparent; cursor: pointer; text-align: left; }
  .personal-mix-load strong { overflow: hidden; font-size: 0.72rem; font-weight: 560; text-overflow: ellipsis; white-space: nowrap; }
  .personal-mix-load span { overflow: hidden; color: rgba(255, 255, 255, 0.38); font-size: 0.58rem; text-overflow: ellipsis; white-space: nowrap; }
  .personal-mix-card > div { display: grid; gap: 3px; }
  .personal-mix-card > div button { width: 27px; height: 27px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 9px; color: rgba(255, 255, 255, 0.38); background: transparent; cursor: pointer; }
  .personal-mix-card > div button:hover,
  .personal-mix-card > div button.active { color: var(--accent); background: rgba(var(--accent-rgb), 0.09); }
  .recent-card-row button { min-width: 0; display: grid; gap: 4px; padding: 11px 12px; border: 1px solid rgba(255, 255, 255, 0.07); border-radius: 14px; color: rgba(255, 255, 255, 0.68); background: rgba(22, 25, 27, 0.58); cursor: pointer; text-align: left; }
  .recent-card-row strong { font-size: 0.7rem; font-weight: 550; }
  .recent-card-row span { overflow: hidden; color: rgba(255, 255, 255, 0.35); font-size: 0.57rem; text-overflow: ellipsis; white-space: nowrap; }

  .scene-state.favorite { width: auto; height: auto; color: rgba(17, 19, 21, 0.56); background: transparent; font-size: 0.72rem; box-shadow: none; }
  .scene-card:not(.active) .scene-state.favorite { color: var(--accent); }

  .mix-action-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-top: 8px; }
  .mix-action-row button { min-height: 42px; display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 8px; border: 1px solid rgba(255, 255, 255, 0.09); border-radius: 14px; color: rgba(255, 255, 255, 0.54); background: rgba(19, 22, 24, 0.62); cursor: pointer; font-size: 0.62rem; transition: transform 200ms ease, color 180ms ease, border-color 180ms ease, background 180ms ease; }
  .mix-action-row button:hover { transform: translateY(-1px); color: #fff; border-color: rgba(var(--accent-rgb), 0.34); }
  .mix-action-row button.active { color: #151719; border-color: transparent; background: rgba(var(--accent-rgb), 0.88); }
  .mix-action-row svg { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }

  .track-item { min-width: 0; overflow: hidden; display: grid; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 17px; background: rgba(22, 25, 27, 0.74); transition: border-color 220ms ease, background 220ms ease, box-shadow 220ms ease; }
  .track-item.active { border-color: rgba(var(--accent-rgb), 0.42); background: rgba(19, 23, 25, 0.88); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.055), 0 0 24px rgba(var(--accent-rgb), 0.055); }
  .track-item .track-card { width: 100%; border: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .track-item .track-card.active { color: rgba(255, 255, 255, 0.9); border-color: transparent; background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.13), transparent 74%); box-shadow: none; }
  .track-item.active .track-number { color: rgba(var(--accent-rgb), 0.82); }
  .track-item .track-card.active small { color: rgba(255, 255, 255, 0.43); }
  .layer-volume { display: grid; grid-template-columns: auto minmax(0, 1fr) 28px; align-items: center; gap: 9px; margin: 0 10px 10px; padding: 7px 9px; border-top: 1px solid rgba(255, 255, 255, 0.07); color: rgba(255, 255, 255, 0.4); font-size: 0.58rem; }
  .layer-volume input { height: 24px; }
  .layer-volume input::-webkit-slider-runnable-track { height: 5px; }
  .layer-volume input::-webkit-slider-thumb { width: 16px; height: 16px; margin-top: -6px; }
  .layer-volume input::-moz-range-track,
  .layer-volume input::-moz-range-progress { height: 5px; }
  .layer-volume input::-moz-range-thumb { width: 16px; height: 16px; }
  .layer-volume output { color: rgba(255, 255, 255, 0.72); font-variant-numeric: tabular-nums; text-align: right; }

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

  @media (min-width: 1200px) {
    main.recipes-visible { padding-right: calc(clamp(16px, 3.5vw, 52px) + 308px); }
  }

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
    h1 { font-size: clamp(4rem, 21vw, 6.3rem); }
    .hero-title-row { align-items: center; }
    .scene-favorite-button { width: 43px; height: 43px; margin: 7px 0 0; border-radius: 14px; }
    .scene-hero > p { width: min(100%, 420px); margin-top: 22px; font-size: 0.9rem; }
    .liquid-panel { border-radius: 26px; }
    .library-panel, .mixer-panel { padding: 18px; }
    .recommendation-panel { padding: 18px; }
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
    .mix-action-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .personal-library { padding: 13px; }
    .personal-card-row, .recent-card-row { grid-auto-columns: minmax(168px, 72vw); }
    .scene-card { min-height: 78px; padding: 11px; gap: 9px; }
    .scene-card { min-height: 0; scroll-snap-align: start; }
    .scene-card small { display: none; }
    .scene-card strong { font-size: 0.8rem; }
    .audio-button { width: 88px; height: 88px; }
    .audio-button-core { width: 64px; height: 64px; }
    .track-card:last-child:nth-child(odd) { grid-column: auto; }
    .quiet-view-button { left: 16px; bottom: 16px; width: 46px; height: 46px; border-radius: 15px; }
    .recipe-drawer { top: 88px; right: 10px; width: min(82vw, 304px); }
    .recipe-drawer.closed { transform: translateX(calc(100% + 10px)); }
    .recipe-drawer-handle { top: 28px; left: -42px; width: 43px; height: 58px; }
    .recommendation-panel { max-height: calc(100svh - 106px); }
    .settings-backdrop { align-items: end; padding: 0; }
    .settings-modal { width: 100%; max-height: calc(100svh - 18px); border-radius: 28px 28px 0 0; }
    .settings-header { padding: 21px 19px 17px; }
    .settings-layout { min-height: 0; max-height: calc(100svh - 116px); display: block; overflow: auto; }
    .settings-tabs { position: sticky; z-index: 2; top: 0; grid-auto-flow: column; grid-auto-columns: max-content; overflow-x: auto; padding: 12px 14px; border-right: 0; border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(15, 18, 20, 0.82); backdrop-filter: blur(22px); scrollbar-width: none; }
    .settings-tabs::-webkit-scrollbar { display: none; }
    .settings-tabs button { min-height: 40px; padding: 9px 12px; }
    .settings-tabs button:hover { transform: none; }
    .settings-content { overflow: visible; padding: 20px 17px 28px; }
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
    .mix-action-row button { justify-content: flex-start; padding-inline: 12px; }
    .app-toast { bottom: 14px; width: max-content; max-width: calc(100vw - 28px); justify-content: center; text-align: center; }
    .video-card strong { font-size: 0.72rem; }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  }
</style>
