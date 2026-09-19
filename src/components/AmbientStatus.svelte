<script>
  import { createEventDispatcher, onDestroy, onMount } from "svelte";
  import { trackEvent } from "../analytics";
  import { buildCurrentWeatherUrl, parseCurrentWeather, roundedWeatherCoordinates } from "../weather.mjs";

  export let immersive = false;

  const dispatch = createEventDispatcher();

  const clockFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  const fullDateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });
  const compactDateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" });
  const weatherRefreshMilliseconds = 15 * 60 * 1000;

  let now = new Date();
  let weatherState = "idle";
  let weather;
  let roundedPosition;
  let clockTimer;
  let refreshTimer;
  let permissionStatus;
  let abortController;
  let destroyed = false;

  $: clockText = clockFormatter.format(now);
  $: fullDateText = fullDateFormatter.format(now);
  $: compactDateText = compactDateFormatter.format(now);
  $: weatherText = weatherState === "ready"
    ? `${weather.temperature}${weather.unit} · ${weather.label}`
    : weatherState === "locating" || weatherState === "loading"
      ? "Checking weather"
      : weatherState === "denied"
        ? "Location blocked"
        : weatherState === "secure"
          ? "Weather needs HTTPS"
          : weatherState === "unavailable"
            ? "Weather unavailable"
            : "Add local weather";
  $: weatherShortText = weatherState === "ready" ? `${weather.temperature}${weather.unit}` : weatherState === "idle" ? "Weather" : weatherText;
  $: weatherActionLabel = weatherState === "ready"
    ? `Refresh local weather. Currently ${weatherText}`
    : weatherState === "idle"
      ? "Add local weather using this device's location"
      : weatherText;

  function isLocationContextAvailable(notify = true) {
    const localHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    if (!window.isSecureContext && !localHost) {
      weatherState = "secure";
      if (notify) dispatch("notice", "Local weather needs HTTPS. Open the secure GitHub Pages site to allow location.");
      return false;
    }
    if (!("geolocation" in navigator)) {
      weatherState = "unavailable";
      if (notify) dispatch("notice", "Location services are unavailable in this browser.");
      return false;
    }
    return true;
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => loadWeather(roundedPosition, false), weatherRefreshMilliseconds);
  }

  async function loadWeather(position, userInitiated) {
    if (!position || destroyed) return;
    weatherState = "loading";
    abortController?.abort();
    abortController = new AbortController();
    const abortTimer = window.setTimeout(() => abortController?.abort(), 9000);

    try {
      const response = await fetch(buildCurrentWeatherUrl(position.latitude, position.longitude), {
        signal: abortController.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Weather request failed with ${response.status}`);
      weather = parseCurrentWeather(await response.json());
      weatherState = "ready";
      trackEvent(userInitiated ? "weather_enable" : "weather_refresh", {
        weather_condition: weather.label.toLowerCase().replaceAll(" ", "_"),
        weather_temperature_c: weather.temperature,
      });
      scheduleRefresh();
    } catch (error) {
      if (!destroyed) {
        weatherState = "unavailable";
        if (userInitiated) dispatch("notice", "Weather could not load. Check your connection and try again.");
        trackEvent("weather_unavailable", { failure_stage: error?.name === "AbortError" ? "timeout" : "forecast" });
      }
    } finally {
      window.clearTimeout(abortTimer);
    }
  }

  function requestLocalWeather(userInitiated = true) {
    if (!isLocationContextAvailable()) return;
    if (roundedPosition) {
      loadWeather(roundedPosition, userInitiated);
      return;
    }

    weatherState = "locating";
    if (userInitiated) trackEvent("weather_permission_request");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        roundedPosition = roundedWeatherCoordinates(position.coords.latitude, position.coords.longitude);
        loadWeather(roundedPosition, userInitiated);
      },
      (error) => {
        weatherState = error.code === 1 ? "denied" : "unavailable";
        dispatch("notice", error.code === 1
          ? "Location is blocked. Allow it in this site's browser settings and try again."
          : "Your location could not be found. Please try again.");
        trackEvent("weather_unavailable", { failure_stage: error.code === 1 ? "permission" : "location" });
      },
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 30 * 60 * 1000 },
    );
  }

  function handlePermissionChange() {
    if (permissionStatus?.state === "granted") requestLocalWeather(false);
    else if (permissionStatus?.state === "denied") weatherState = "denied";
    else weatherState = "idle";
  }

  async function inspectLocationPermission() {
    if (!isLocationContextAvailable(false) || !navigator.permissions?.query) return;
    try {
      permissionStatus = await navigator.permissions.query({ name: "geolocation" });
      permissionStatus.addEventListener?.("change", handlePermissionChange);
      handlePermissionChange();
    } catch (error) {
      // Safari does not expose geolocation through Permissions; the button still works.
    }
  }

  onMount(() => {
    clockTimer = window.setInterval(() => (now = new Date()), 15000);
    inspectLocationPermission();
  });

  onDestroy(() => {
    destroyed = true;
    window.clearInterval(clockTimer);
    window.clearTimeout(refreshTimer);
    abortController?.abort();
    permissionStatus?.removeEventListener?.("change", handlePermissionChange);
  });
</script>

<section class:immersive class="ambient-status" aria-label="Current date, time, and local weather">
  <time class="status-time" datetime={now.toISOString()}>{clockText}</time>
  <span class="status-divider" aria-hidden="true"></span>
  <span class="status-details">
    <time class="status-date" datetime={now.toISOString().slice(0, 10)}>
      <span class="date-full">{fullDateText}</span>
      <span class="date-compact">{compactDateText}</span>
    </time>
    <button
      class:loading={weatherState === "locating" || weatherState === "loading"}
      class="weather-action"
      type="button"
      aria-label={weatherActionLabel}
      title={weatherState === "ready" ? `Feels like ${weather.apparentTemperature ?? weather.temperature}${weather.unit} · Weather data by Open-Meteo` : weatherActionLabel}
      on:click={() => requestLocalWeather(true)}
    >
      <svg class={`weather-icon ${weather?.icon || "location"}`} viewBox="0 0 24 24" aria-hidden="true">
        {#if weather?.icon === "sun"}
          <circle cx="12" cy="12" r="3.4" /><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" />
        {:else if weather?.icon === "moon"}
          <path d="M18.4 15.7A7.3 7.3 0 0 1 8.3 5.6a7.4 7.4 0 1 0 10.1 10.1Z" />
        {:else if weather?.icon === "partly-cloudy"}
          <circle cx="8.1" cy="8" r="2.7" /><path d="M8.1 3.5v1.1M3.6 8h1.1M4.9 4.8l.8.8M11.2 4.8l-.7.8M6.2 17.7h10.7a3.1 3.1 0 0 0 .2-6.2 5 5 0 0 0-9.5 1.1 2.6 2.6 0 0 0-1.4 5.1Z" />
        {:else if weather?.icon === "fog"}
          <path d="M5 8.2h11M3.5 12h16M6 15.8h12" />
        {:else if weather?.icon === "rain"}
          <path d="M6.1 14.8h11a3.2 3.2 0 0 0 .2-6.4 5.1 5.1 0 0 0-9.7 1.2 2.7 2.7 0 0 0-1.5 5.2Z" /><path class="weather-motion" d="m8 18-1 2M12 18l-1 2M16 18l-1 2" />
        {:else if weather?.icon === "snow"}
          <path d="M6.1 13.8h11a3.2 3.2 0 0 0 .2-6.4 5.1 5.1 0 0 0-9.7 1.2 2.7 2.7 0 0 0-1.5 5.2Z" /><path class="weather-motion" d="M8 17v3M6.7 18.5h2.6M13 17v3M11.7 18.5h2.6M18 17v3M16.7 18.5h2.6" />
        {:else if weather?.icon === "storm"}
          <path d="M6.1 13.8h11a3.2 3.2 0 0 0 .2-6.4 5.1 5.1 0 0 0-9.7 1.2 2.7 2.7 0 0 0-1.5 5.2Z" /><path class="weather-motion" d="m12.2 15.5-2 3.2h2.2l-1 2.5 3.1-4h-2.2l1.2-1.7" />
        {:else if weather?.icon === "cloud"}
          <path d="M5.2 17h12.1a3.5 3.5 0 0 0 .2-7 5.5 5.5 0 0 0-10.6 1.3A3 3 0 0 0 5.2 17Z" />
        {:else}
          <path d="M12 20s5.5-5.2 5.5-10a5.5 5.5 0 0 0-11 0c0 4.8 5.5 10 5.5 10Z" /><circle cx="12" cy="10" r="1.8" />
        {/if}
      </svg>
      <span class="weather-label-full" aria-live="polite">{weatherText}</span>
      <span class="weather-label-short" aria-hidden="true">{weatherShortText}</span>
    </button>
  </span>
</section>

<style>
  .ambient-status {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 11px;
    padding: 6px 12px 6px 14px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    border-radius: 17px;
    color: rgba(255, 255, 255, 0.88);
    background:
      radial-gradient(circle at 16% 0%, rgba(var(--accent-rgb), 0.1), transparent 54%),
      rgba(17, 20, 22, 0.38);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 9px 26px rgba(0, 0, 0, 0.14);
    backdrop-filter: blur(22px) saturate(145%);
    -webkit-backdrop-filter: blur(22px) saturate(145%);
    transition: border-color 300ms ease, background 300ms ease, box-shadow 300ms ease, transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .ambient-status.immersive {
    min-height: 84px;
    gap: clamp(15px, 2vw, 28px);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    text-shadow: 0 2px 18px rgba(0, 0, 0, 0.44);
    animation: status-settle 600ms 140ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .ambient-status.immersive .status-time {
    min-width: 0;
    font-size: clamp(2.5rem, 5.2vw, 4.8rem);
    font-weight: 430;
    letter-spacing: -0.065em;
  }

  .ambient-status.immersive .status-divider {
    height: clamp(48px, 6vw, 72px);
    opacity: 0.78;
  }

  .ambient-status.immersive .status-details {
    min-width: clamp(160px, 18vw, 240px);
    gap: 7px;
  }

  .ambient-status.immersive .status-date {
    color: rgba(255, 255, 255, 0.68);
    font-size: clamp(0.75rem, 1.15vw, 1rem);
    letter-spacing: 0.12em;
  }

  .ambient-status.immersive .weather-action {
    gap: 9px;
    color: rgba(255, 255, 255, 0.9);
    font-size: clamp(0.84rem, 1.2vw, 1.05rem);
  }

  .ambient-status.immersive .weather-icon {
    width: 20px;
    height: 20px;
    flex-basis: 20px;
    stroke-width: 1.4;
  }

  @keyframes status-settle {
    from { opacity: 0; transform: translateY(-8px); filter: blur(5px); }
    to { opacity: 1; transform: none; filter: none; }
  }

  .status-time {
    min-width: 48px;
    font-size: 1rem;
    font-weight: 510;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.035em;
    text-align: center;
  }

  .status-divider {
    width: 1px;
    height: 25px;
    flex: 0 0 1px;
    background: linear-gradient(180deg, transparent, rgba(var(--accent-rgb), 0.62), transparent);
    box-shadow: 0 0 9px rgba(var(--accent-rgb), 0.15);
  }

  .status-details {
    min-width: 112px;
    display: grid;
    align-items: center;
    gap: 2px;
  }

  .status-date {
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.56rem;
    font-weight: 650;
    letter-spacing: 0.095em;
    line-height: 1;
    text-transform: uppercase;
  }

  .date-compact,
  .weather-label-short { display: none; }

  .weather-action {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0;
    border: 0;
    color: rgba(255, 255, 255, 0.78);
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 0.62rem;
    line-height: 1.15;
    text-align: left;
    transition: color 180ms ease, transform 220ms ease;
  }

  .weather-action:hover { color: #fff; transform: translateX(1px); }
  .weather-action:focus-visible { outline: 1px solid rgba(var(--accent-rgb), 0.7); outline-offset: 4px; border-radius: 4px; }
  .weather-icon { width: 13px; height: 13px; flex: 0 0 13px; overflow: visible; fill: none; stroke: var(--accent); stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 5px rgba(var(--accent-rgb), 0.28)); }
  .weather-icon.sun { animation: sun-drift 8s linear infinite; }
  .weather-action.loading .weather-icon { animation: weather-breathe 1.1s ease-in-out infinite; }
  .weather-motion { animation: weather-breathe 1.7s ease-in-out infinite; }
  @keyframes sun-drift { to { transform: rotate(360deg); } }
  @keyframes weather-breathe { 50% { opacity: 0.34; transform: translateY(1px); } }

  @media (max-width: 900px) {
    .ambient-status { gap: 8px; padding-inline: 10px; }
    .status-details { min-width: 100px; }
  }

  @media (max-width: 520px) {
    .ambient-status { min-height: 42px; gap: 7px; padding: 5px 9px; border-radius: 15px; }
    .status-time { min-width: 42px; font-size: 0.9rem; }
    .status-divider { height: 22px; }
    .status-details { min-width: 72px; }
    .date-full,
    .weather-label-full { display: none; }
    .date-compact,
    .weather-label-short { display: inline; }
    .status-date { font-size: 0.5rem; letter-spacing: 0.075em; }
    .weather-action { font-size: 0.58rem; }
    .weather-icon { width: 12px; height: 12px; flex-basis: 12px; }
    .ambient-status.immersive { min-height: 68px; gap: 12px; }
    .ambient-status.immersive .status-time { font-size: clamp(2rem, 12vw, 3.25rem); }
    .ambient-status.immersive .status-divider { height: 46px; }
    .ambient-status.immersive .status-details { min-width: 132px; }
    .ambient-status.immersive .date-full,
    .ambient-status.immersive .weather-label-full { display: inline; }
    .ambient-status.immersive .date-compact,
    .ambient-status.immersive .weather-label-short { display: none; }
  }

  @media (max-width: 355px) {
    .ambient-status { gap: 5px; padding-inline: 7px; }
    .status-details { min-width: 61px; }
    .weather-icon { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ambient-status,
    .weather-icon,
    .weather-motion { animation: none !important; transition-duration: 0.01ms !important; }
  }
</style>
