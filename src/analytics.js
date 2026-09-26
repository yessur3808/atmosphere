const measurementIdPattern = /^G-[A-Z0-9]{6,}$/i;
const consentStorageKey = "atmosphere-analytics-consent-v1";
const heartbeatMilliseconds = 60000;
const listeningMilestones = [60, 300, 900, 1800, 3600];
const analyticsSchema = "2.0";

let measurementId = "";
let consent = "unset";
let configured = false;
let initialized = false;
let tagLoaded = false;
let contextProvider = () => ({});
let heartbeatTimer;
let lastClock = performance.now();
let pageWasVisible = document.visibilityState === "visible";
let activeMilliseconds = 0;
let listeningMilliseconds = 0;
let quietMilliseconds = 0;
let reportedListeningMilliseconds = 0;
let heartbeatNumber = 0;
let reachedMilestones = new Set();
let uniqueSceneIds = new Set();
let uniqueTrackIds = new Set();
let sessionCounters = {};
let largestContentfulPaint = 0;
let cumulativeLayoutShift = 0;
let interactionToNextPaint = 0;
let performanceObservers = [];

function gtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

function safeContext() {
  try {
    return contextProvider() || {};
  } catch (error) {
    return {};
  }
}

function viewportBucket() {
  const width = window.innerWidth;
  if (width < 480) return "phone-small";
  if (width < 768) return "phone-large";
  if (width < 1120) return "tablet";
  if (width < 1600) return "desktop";
  return "desktop-wide";
}

function appSurface() {
  return window.__TAURI_INTERNALS__ ? "desktop_app" : "web";
}

function displayMode() {
  if (window.matchMedia?.("(display-mode: standalone)").matches) return "standalone";
  if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return "minimal_ui";
  return "browser";
}

function cleanParameters(parameters = {}) {
  return Object.fromEntries(Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => {
      if (typeof value === "string") return [key, value.slice(0, 100)];
      if (typeof value === "boolean") return [key, value ? "true" : "false"];
      return [key, value];
    }));
}

function sharedParameters() {
  const context = safeContext();
  return cleanParameters({
    analytics_schema: analyticsSchema,
    app_surface: appSurface(),
    display_mode: displayMode(),
    scene_id: context.sceneId,
    scene_title: context.sceneTitle,
    scene_category: context.sceneCategory,
    track_id: context.trackId,
    track_type: context.trackType,
    active_sound_count: context.activeSoundCount,
    sound_category: context.soundCategory,
    recipe_id: context.recipeId,
    recipe_title: context.recipeTitle,
    mix_source: context.mixSource,
    video_id: context.videoId,
    playback_mode: context.linkedPlayback ? "unified" : "separate",
    data_saver: context.dataSaverMode,
    media_quality_preference: context.mediaQualityPreference,
    video_quality: context.effectiveVideoQuality,
    audio_quality: context.effectiveAudioQuality,
    connection_type: context.connectionType,
    save_data: context.saveData,
    smart_mix: context.smartMixEnabled,
    live_weather: context.weatherMatchActive,
    quiet_view: context.immersiveMode,
    viewport_bucket: viewportBucket(),
  });
}

function resetSessionCounters() {
  sessionCounters = {
    playbackStarts: 0,
    sceneChanges: 0,
    trackChanges: 0,
    mixActions: 0,
    discoveryActions: 0,
    featureActions: 0,
    errors: 0,
  };
  uniqueSceneIds = new Set();
  uniqueTrackIds = new Set();
}

function noteEvent(name, parameters) {
  const contentUseEvents = [
    "playback_start",
    "listening_interval",
    "atmosphere_select",
    "audio_layer_select",
    "audio_layer_remove",
    "sound_recipe_apply",
    "mix_load",
  ];
  if (contentUseEvents.includes(name)) {
    if (parameters.scene_id) uniqueSceneIds.add(parameters.scene_id);
    String(parameters.track_id || "").split(",").filter(Boolean).forEach((trackId) => uniqueTrackIds.add(trackId));
  }

  if (name === "playback_start") sessionCounters.playbackStarts += 1;
  if (name === "atmosphere_select") sessionCounters.sceneChanges += 1;
  if (["audio_layer_select", "audio_layer_remove", "sound_subcategory_select"].includes(name)) sessionCounters.trackChanges += 1;
  if (["mix_load", "mix_save", "mix_share", "mix_delete", "mix_favorite", "sound_recipe_apply"].includes(name)) {
    sessionCounters.mixActions += 1;
  }
  if (["scene_search", "scene_filter", "mix_intent_filter", "weather_match_request"].includes(name)) {
    sessionCounters.discoveryActions += 1;
  }
  if ([
    "data_saver_preference",
    "library_tools_toggle",
    "linked_playback_preference",
    "media_quality_preference",
    "media_quality_auto_change",
    "mini_player_preference",
    "multi_sound_preference",
    "player_details_toggle",
    "pwa_install_complete",
    "quiet_view_enter",
    "quiet_view_exit",
    "settings_open",
    "settings_close",
    "settings_tab_view",
    "smart_mix_preference",
    "weather_auto_match_preference",
    "weather_follow_time_preference",
    "weather_match_apply",
    "weather_mode_preference",
    "weather_strength_preference",
  ].includes(name)) {
    sessionCounters.featureActions += 1;
  }
  if (name.endsWith("_error") || name.endsWith("_unavailable")) sessionCounters.errors += 1;
}

function updateClocks(now = performance.now()) {
  const elapsed = Math.max(0, Math.min(now - lastClock, heartbeatMilliseconds * 2));
  lastClock = now;
  if (!pageWasVisible) return;

  activeMilliseconds += elapsed;
  const context = safeContext();
  if (context.isAudioPlaying) listeningMilliseconds += elapsed;
  if (context.immersiveMode) quietMilliseconds += elapsed;
}

function resetClocks() {
  lastClock = performance.now();
  pageWasVisible = document.visibilityState === "visible";
  activeMilliseconds = 0;
  listeningMilliseconds = 0;
  quietMilliseconds = 0;
  reportedListeningMilliseconds = 0;
  heartbeatNumber = 0;
  reachedMilestones = new Set();
  resetSessionCounters();
}

function loadGoogleTag() {
  if (!configured || tagLoaded) return;
  tagLoaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.dataset.atmosphereAnalytics = "true";
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", measurementId, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    anonymize_ip: true,
    cookie_expires: 34128000,
    cookie_flags: window.location.protocol === "https:" ? "SameSite=Lax;Secure" : "SameSite=Lax",
    transport_type: "beacon",
  });
}

function clearAnalyticsCookies() {
  const names = document.cookie.split(";")
    .map((cookie) => cookie.split("=")[0].trim())
    .filter((name) => /^_(?:ga|gid|gat)(?:_|$)/i.test(name));
  const basePath = new URL(".", document.baseURI).pathname || "/";
  const currentPath = window.location.pathname.replace(/[^/]*$/, "") || "/";
  const paths = [...new Set(["/", basePath, currentPath])];
  const hostname = window.location.hostname;
  const domains = hostname && hostname.includes(".") ? ["", hostname, `.${hostname}`] : [""];
  names.forEach((name) => {
    paths.forEach((path) => {
      domains.forEach((domain) => {
        document.cookie = `${name}=; Max-Age=0; path=${path};${domain ? ` domain=${domain};` : ""} SameSite=Lax`;
      });
    });
  });
  return names.length;
}

function sendPageView() {
  const pageLocation = new URL(window.location.href);
  if (pageLocation.searchParams.has("mix")) pageLocation.searchParams.set("mix", "shared");
  pageLocation.searchParams.delete("debug_analytics");
  trackEvent("page_view", {
    page_title: document.title,
    page_location: pageLocation.toString(),
    page_path: `${window.location.pathname}${window.location.hash}`,
  });
}

function beginPerformanceTracking() {
  if (!("PerformanceObserver" in window) || performanceObservers.length) return;

  const observe = (type, callback) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback));
      observer.observe({ type, buffered: true });
      performanceObservers.push(observer);
    } catch (error) {
      // Unsupported entry types are expected on older Safari and Firefox versions.
    }
  };

  observe("largest-contentful-paint", (entry) => {
    largestContentfulPaint = Math.max(largestContentfulPaint, entry.startTime);
  });
  observe("layout-shift", (entry) => {
    if (!entry.hadRecentInput) cumulativeLayoutShift += entry.value;
  });
  observe("event", (entry) => {
    if (entry.interactionId) interactionToNextPaint = Math.max(interactionToNextPaint, entry.duration);
  });
}

function flushPerformance() {
  if (consent !== "granted") return;
  const metrics = [
    ["LCP", largestContentfulPaint, "millisecond"],
    ["CLS", cumulativeLayoutShift * 1000, "score_x1000"],
    ["INP", interactionToNextPaint, "millisecond"],
  ];
  metrics.filter(([, value]) => value > 0).forEach(([metricName, value, unit]) => {
    trackEvent("web_vital", {
      metric_name: metricName,
      metric_value: Math.round(value),
      metric_unit: unit,
    });
  });
}

function emitMilestones() {
  const listeningSeconds = Math.floor(listeningMilliseconds / 1000);
  listeningMilestones.forEach((milestoneSeconds) => {
    if (listeningSeconds < milestoneSeconds || reachedMilestones.has(milestoneSeconds)) return;
    reachedMilestones.add(milestoneSeconds);
    trackEvent("listening_milestone", {
      milestone_seconds: milestoneSeconds,
      milestone_minutes: milestoneSeconds / 60,
    });
    if (milestoneSeconds === 300) {
      trackEvent("meaningful_listening", {
        milestone_seconds: milestoneSeconds,
        milestone_minutes: milestoneSeconds / 60,
      });
      trackEvent("monetization_eligible", {
        eligibility_reason: "five_minute_listening_session",
        listening_seconds: listeningSeconds,
      });
    }
    if (milestoneSeconds === 900) {
      trackEvent("retained_listening", {
        milestone_seconds: milestoneSeconds,
        milestone_minutes: milestoneSeconds / 60,
      });
    }
  });
}

function flushListeningInterval(reason = "checkpoint") {
  if (consent !== "granted") return;
  updateClocks();
  const intervalMilliseconds = Math.max(0, listeningMilliseconds - reportedListeningMilliseconds);
  if (intervalMilliseconds < 1000) return;
  reportedListeningMilliseconds = listeningMilliseconds;
  trackEvent("listening_interval", {
    listening_interval_seconds: Math.round(intervalMilliseconds / 1000),
    interval_reason: reason,
  });
}

function sendHeartbeat() {
  if (consent !== "granted") return;
  updateClocks();
  heartbeatNumber += 1;
  emitMilestones();
  flushListeningInterval("heartbeat");
  trackEvent("engagement_heartbeat", {
    heartbeat_number: heartbeatNumber,
    active_seconds: Math.round(activeMilliseconds / 1000),
    listening_seconds: Math.round(listeningMilliseconds / 1000),
    quiet_view_seconds: Math.round(quietMilliseconds / 1000),
    audio_playing: Boolean(safeContext().isAudioPlaying),
  });
}

function sendSessionSummary(reason) {
  if (consent !== "granted") return;
  updateClocks();
  emitMilestones();
  flushListeningInterval(reason);
  trackEvent("session_summary", {
    summary_reason: reason,
    active_seconds: Math.round(activeMilliseconds / 1000),
    listening_seconds: Math.round(listeningMilliseconds / 1000),
    quiet_view_seconds: Math.round(quietMilliseconds / 1000),
    session_active_seconds: Math.round(activeMilliseconds / 1000),
    session_listening_seconds: Math.round(listeningMilliseconds / 1000),
    session_quiet_seconds: Math.round(quietMilliseconds / 1000),
    playback_starts: sessionCounters.playbackStarts,
    scene_changes: sessionCounters.sceneChanges,
    track_changes: sessionCounters.trackChanges,
    mix_actions: sessionCounters.mixActions,
    discovery_actions: sessionCounters.discoveryActions,
    feature_actions: sessionCounters.featureActions,
    error_count: sessionCounters.errors,
    unique_scene_count: uniqueSceneIds.size,
    unique_track_count: uniqueTrackIds.size,
    transport_type: "beacon",
  });
  flushPerformance();
}

function handleVisibilityChange() {
  updateClocks();
  if (document.visibilityState !== "visible") flushListeningInterval("visibility_hidden");
  pageWasVisible = document.visibilityState === "visible";
}

function handlePageHide() {
  sendSessionSummary("pagehide");
}

function installLifecycleTracking() {
  if (heartbeatTimer) return;
  heartbeatTimer = window.setInterval(sendHeartbeat, heartbeatMilliseconds);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePageHide);
  window.addEventListener("hashchange", sendPageView);
  window.addEventListener("beforeinstallprompt", handleInstallAvailable);
  window.addEventListener("appinstalled", handleAppInstalled);
}

function handleInstallAvailable() {
  trackEvent("pwa_install_available");
}

function handleAppInstalled() {
  trackEvent("pwa_install_complete");
}

export function initializeAnalytics(getContext = () => ({})) {
  if (initialized) return getAnalyticsStatus();
  initialized = true;
  contextProvider = getContext;
  measurementId = document.querySelector('meta[name="google-analytics-id"]')?.content?.trim() || "";
  configured = measurementIdPattern.test(measurementId) && !measurementId.includes("XXXX");
  consent = localStorage.getItem(consentStorageKey) || "unset";
  if (!["granted", "denied", "unset"].includes(consent)) consent = "unset";
  const privacySignal = navigator.globalPrivacyControl === true
    || navigator.doNotTrack === "1"
    || window.doNotTrack === "1";
  if (consent === "unset" && privacySignal) {
    consent = "denied";
    localStorage.setItem(consentStorageKey, consent);
  }
  if (configured) window[`ga-disable-${measurementId}`] = consent !== "granted";

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || gtag;
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    wait_for_update: 500,
  });

  installLifecycleTracking();
  if (configured && consent === "granted") {
    window[`ga-disable-${measurementId}`] = false;
    gtag("consent", "update", { analytics_storage: "granted" });
    loadGoogleTag();
    resetClocks();
    beginPerformanceTracking();
    sendPageView();
  }
  return getAnalyticsStatus();
}

export function setAnalyticsConsent(nextConsent) {
  consent = nextConsent === "granted" ? "granted" : "denied";
  localStorage.setItem(consentStorageKey, consent);
  if (configured) window[`ga-disable-${measurementId}`] = consent !== "granted";
  gtag("consent", "update", {
    analytics_storage: consent,
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  if (consent === "granted" && configured) {
    loadGoogleTag();
    resetClocks();
    beginPerformanceTracking();
    sendPageView();
    trackEvent("analytics_consent_update", { analytics_consent: "granted" });
  } else {
    clearAnalyticsCookies();
  }
  return getAnalyticsStatus();
}

export function getAnalyticsStatus() {
  return { configured, consent, measurementId: configured ? measurementId : "" };
}

export function checkpointAnalytics(reason = "interface_change") {
  flushListeningInterval(reason);
}

export function trackEvent(name, parameters = {}) {
  if (!configured || consent !== "granted" || !/^[a-z][a-z0-9_]{0,39}$/.test(name)) return;
  const eventParameters = cleanParameters({ ...sharedParameters(), ...parameters });
  noteEvent(name, eventParameters);
  gtag("event", name, eventParameters);
}

export function destroyAnalytics() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
  performanceObservers.forEach((observer) => observer.disconnect());
  performanceObservers = [];
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("pagehide", handlePageHide);
  window.removeEventListener("hashchange", sendPageView);
  window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
  window.removeEventListener("appinstalled", handleAppInstalled);
  initialized = false;
}
