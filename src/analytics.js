const measurementIdPattern = /^G-[A-Z0-9]{6,}$/i;
const consentStorageKey = "atmosphere-analytics-consent-v1";
const heartbeatMilliseconds = 60000;
const listeningMilestones = [60, 300, 900, 1800, 3600];

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
let heartbeatNumber = 0;
let reachedMilestones = new Set();
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
    scene_id: context.sceneId,
    scene_title: context.sceneTitle,
    track_id: context.trackId,
    active_sound_count: context.activeSoundCount,
    video_id: context.videoId,
    playback_mode: context.linkedPlayback ? "unified" : "separate",
    quiet_view: context.immersiveMode,
    viewport_bucket: viewportBucket(),
  });
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
  heartbeatNumber = 0;
  reachedMilestones = new Set();
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
    transport_type: "beacon",
  });
}

function sendPageView() {
  trackEvent("page_view", {
    page_title: document.title,
    page_location: window.location.href,
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
      trackEvent("monetization_eligible", {
        eligibility_reason: "five_minute_listening_session",
        listening_seconds: listeningSeconds,
      });
    }
  });
}

function sendHeartbeat() {
  if (consent !== "granted") return;
  updateClocks();
  heartbeatNumber += 1;
  emitMilestones();
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
  trackEvent("session_summary", {
    summary_reason: reason,
    active_seconds: Math.round(activeMilliseconds / 1000),
    listening_seconds: Math.round(listeningMilliseconds / 1000),
    quiet_view_seconds: Math.round(quietMilliseconds / 1000),
    transport_type: "beacon",
  });
  flushPerformance();
}

function handleVisibilityChange() {
  updateClocks();
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
}

export function initializeAnalytics(getContext = () => ({})) {
  if (initialized) return getAnalyticsStatus();
  initialized = true;
  contextProvider = getContext;
  measurementId = document.querySelector('meta[name="google-analytics-id"]')?.content?.trim() || "";
  configured = measurementIdPattern.test(measurementId) && !measurementId.includes("XXXX");
  consent = localStorage.getItem(consentStorageKey) || "unset";
  if (!["granted", "denied", "unset"].includes(consent)) consent = "unset";

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
  }
  return getAnalyticsStatus();
}

export function getAnalyticsStatus() {
  return { configured, consent, measurementId: configured ? measurementId : "" };
}

export function trackEvent(name, parameters = {}) {
  if (!configured || consent !== "granted" || !/^[a-z][a-z0-9_]{0,39}$/.test(name)) return;
  gtag("event", name, cleanParameters({ ...sharedParameters(), ...parameters }));
}

export function destroyAnalytics() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
  performanceObservers.forEach((observer) => observer.disconnect());
  performanceObservers = [];
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("pagehide", handlePageHide);
  window.removeEventListener("hashchange", sendPageView);
  initialized = false;
}
