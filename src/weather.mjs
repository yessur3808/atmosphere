const forecastEndpoint = "https://api.open-meteo.com/v1/forecast";
const geocodingEndpoint = "https://geocoding-api.open-meteo.com/v1/search";

export function weatherConditionForCode(value, isDay = true) {
  const code = Number(value);
  if (code === 0) return { label: isDay ? "Clear" : "Clear night", icon: isDay ? "sun" : "moon" };
  if ([1, 2].includes(code)) return { label: "Partly cloudy", icon: "partly-cloudy" };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if ([45, 48].includes(code)) return { label: "Fog", icon: "fog" };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: "Drizzle", icon: "rain" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: "Rain", icon: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: "Snow", icon: "snow" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", icon: "storm" };
  return { label: "Local weather", icon: "cloud" };
}

export function roundedWeatherCoordinates(latitude, longitude) {
  const numericLatitude = Number(latitude);
  const numericLongitude = Number(longitude);
  if (!Number.isFinite(numericLatitude) || numericLatitude < -90 || numericLatitude > 90) {
    throw new RangeError("Latitude must be between -90 and 90");
  }
  if (!Number.isFinite(numericLongitude) || numericLongitude < -180 || numericLongitude > 180) {
    throw new RangeError("Longitude must be between -180 and 180");
  }
  return {
    latitude: Math.round(numericLatitude * 100) / 100,
    longitude: Math.round(numericLongitude * 100) / 100,
  };
}

export function buildCurrentWeatherUrl(latitude, longitude) {
  const rounded = roundedWeatherCoordinates(latitude, longitude);
  const url = new URL(forecastEndpoint);
  url.search = new URLSearchParams({
    latitude: String(rounded.latitude),
    longitude: String(rounded.longitude),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m,is_day",
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
    timezone: "auto",
    forecast_days: "1",
  }).toString();
  return url.toString();
}

export function buildCitySearchUrl(query) {
  const normalizedQuery = String(query || "").trim();
  if (normalizedQuery.length < 2) throw new RangeError("Enter at least two characters");
  const url = new URL(geocodingEndpoint);
  url.search = new URLSearchParams({ name: normalizedQuery, count: "8", language: "en", format: "json" }).toString();
  return url.toString();
}

export function normalizeCityName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function editDistance(left, right) {
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

export function cityNameSimilarity(query, cityName) {
  const normalizedQuery = normalizeCityName(String(query || "").split(",")[0]);
  const normalizedCity = normalizeCityName(cityName);
  if (!normalizedQuery || !normalizedCity) return 0;
  const longestLength = Math.max(normalizedQuery.length, normalizedCity.length);
  return Math.round((1 - editDistance(normalizedQuery, normalizedCity) / longestLength) * 100) / 100;
}

export function citySearchFallbackQuery(query) {
  const cityPart = normalizeCityName(String(query || "").split(",")[0]);
  const firstWord = cityPart.split(" ")[0] || "";
  return firstWord.length > 3 ? firstWord.slice(0, 3) : "";
}

export function parseCitySuggestions(payload, query) {
  const seen = new Set();
  return (Array.isArray(payload?.results) ? payload.results : [])
    .map((result) => {
      const coordinates = roundedWeatherCoordinates(result.latitude, result.longitude);
      const region = result.admin1 && result.admin1 !== result.name ? result.admin1 : "";
      const country = result.country && result.country !== region ? result.country : "";
      const label = [result.name, region, country].filter(Boolean).join(", ");
      return {
        ...coordinates,
        id: String(result.id || `${result.name}-${coordinates.latitude}-${coordinates.longitude}`),
        name: result.name,
        region,
        country,
        label,
        similarity: cityNameSimilarity(query, result.name),
        population: Number(result.population) || 0,
      };
    })
    .filter((result) => {
      const key = `${result.name}|${result.region}|${result.country}|${result.latitude}|${result.longitude}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.similarity - left.similarity || right.population - left.population)
    .slice(0, 6);
}

export function parseCitySearch(payload) {
  const result = payload?.results?.[0];
  if (!result) throw new TypeError("No matching location was found");
  const coordinates = roundedWeatherCoordinates(result.latitude, result.longitude);
  const region = result.admin1 && result.admin1 !== result.name ? result.admin1 : result.country;
  return { ...coordinates, label: [result.name, region].filter(Boolean).join(", ") };
}

function roundedMetric(value, precision = 0) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return undefined;
  const factor = 10 ** precision;
  return Math.round(numericValue * factor) / factor;
}

function timezoneLocationLabel(timezone) {
  const segment = String(timezone || "").split("/").pop();
  if (!segment || ["GMT", "UTC", "auto"].includes(segment)) return "Current location";
  return segment.replaceAll("_", " ");
}

export function parseCurrentWeather(payload, locationLabel = "") {
  const current = payload?.current;
  const temperature = Number(current?.temperature_2m);
  const apparentTemperature = Number(current?.apparent_temperature);
  const weatherCode = Number(current?.weather_code);
  if (!Number.isFinite(temperature) || !Number.isFinite(weatherCode)) {
    throw new TypeError("Weather response is missing current conditions");
  }

  const isDay = Number(current.is_day) !== 0;
  return {
    temperature: Math.round(temperature),
    apparentTemperature: Number.isFinite(apparentTemperature) ? Math.round(apparentTemperature) : undefined,
    humidity: roundedMetric(current.relative_humidity_2m),
    precipitation: roundedMetric(current.precipitation, 1) ?? 0,
    rain: roundedMetric(current.rain, 1) ?? 0,
    snowfall: roundedMetric(current.snowfall, 1) ?? 0,
    windSpeed: roundedMetric(current.wind_speed_10m) ?? 0,
    cloudCover: roundedMetric(current.cloud_cover) ?? 0,
    weatherCode,
    isDay,
    unit: payload?.current_units?.temperature_2m || "°C",
    windUnit: payload?.current_units?.wind_speed_10m || "km/h",
    precipitationUnit: payload?.current_units?.precipitation || "mm",
    observedAt: current.time || "",
    locationLabel: locationLabel || timezoneLocationLabel(payload?.timezone),
    ...weatherConditionForCode(weatherCode, isDay),
  };
}

function scaledVolumes(volumes, strength) {
  const scale = strength === "subtle" ? 0.72 : strength === "immersive" ? 1.12 : 0.92;
  return volumes.map((value) => Math.max(0.12, Math.min(1, Math.round(value * scale * 100) / 100)));
}

function weatherProfile(sceneId, indices, volumes, title, detail, weather, strength) {
  const seed = Math.abs(Number(weather?.weatherCode) || 0) + (weather?.isDay ? 0 : 1);
  return { sceneId, indices, volumes: scaledVolumes(volumes, strength), videoSeed: seed, title, detail };
}

export function weatherAtmosphereProfile(weather, options = {}) {
  if (!weather) throw new TypeError("Current weather is required");
  const mode = options.mode === "comfort" ? "comfort" : "match";
  const strength = ["subtle", "realistic", "immersive"].includes(options.strength) ? options.strength : "realistic";
  const followsLocalTime = options.followTime !== false;
  const isDay = followsLocalTime ? weather.isDay !== false : true;
  const icon = weather.icon;

  if (mode === "comfort") {
    if (["storm", "rain", "snow"].includes(icon)) {
      return weatherProfile("tab_rainy_bedroom", [0, 3, 4], [0.48, 0.34, 0.62], "Shelter from the weather", `A warm room against ${weather.label.toLowerCase()} outside.`, weather, strength);
    }
    if (weather.temperature >= 27) {
      return weatherProfile("tab_forest", [0, 1, 4], [0.42, 0.34, 0.56], "A cooler place", "Forest air and moving water for a warm day.", weather, strength);
    }
    return weatherProfile("tab_fire", [0, 2, 4], [0.42, 0.68, 0.24], "A warmer room", `A gentle contrast to ${weather.label.toLowerCase()} outside.`, weather, strength);
  }

  if (icon === "storm") {
    return weatherProfile("tab_lightning", [0, 1, 3], [0.5, 0.68, 0.3], "Storm matched", "Rain and distant thunder shaped to the current storm.", weather, strength);
  }
  if (icon === "snow") {
    return weatherProfile("tab_snow", [0, 1, 5], [0.38, 0.32, 0.62], "Snow matched", "Winter air with a sheltered fire beneath it.", weather, strength);
  }
  if (icon === "rain") {
    const heavyRain = Math.max(weather.precipitation || 0, weather.rain || 0) >= 4;
    if (!isDay) {
      return weatherProfile("tab_rainy_bedroom", heavyRain ? [0, 2, 3] : [0, 1, 3], heavyRain ? [0.76, 0.58, 0.24] : [0.66, 0.42, 0.22], "Rain matched", "Window rain softened by a quiet room after dark.", weather, strength);
    }
    return weatherProfile("tab_rain", heavyRain ? [1, 3, 4] : [0, 2, 3], heavyRain ? [0.72, 0.58, 0.38] : [0.62, 0.4, 0.28], "Rain matched", "A rain mix shaped to the current precipitation.", weather, strength);
  }
  if ((weather.windSpeed || 0) >= 28) {
    return weatherProfile("tab_wind", [0, 1, 4], [0.5, 0.42, 0.28], "Wind matched", "Open air and long gusts follow the local wind.", weather, strength);
  }
  if (icon === "fog") {
    return weatherProfile("tab_leaves", [0, 1, 4], [0.42, 0.36, 0.24], "Fog matched", "A muted canopy with soft air and distant birds.", weather, strength);
  }
  if (["cloud", "partly-cloudy"].includes(icon)) {
    if (!isDay) return weatherProfile("tab_city_apartment", [0, 1, 3], [0.38, 0.28, 0.42], "Cloudy night matched", "A quiet room above the dim city.", weather, strength);
    return weatherProfile("tab_forest", [0, 1, 2], [0.42, 0.36, 0.3], "Cloud cover matched", "Soft woodland movement under a subdued sky.", weather, strength);
  }
  if (!isDay) {
    return weatherProfile("tab_city_apartment", [0, 3, 5], [0.34, 0.42, 0.22], "Clear night matched", "A still room above the city after dark.", weather, strength);
  }
  if (weather.temperature >= 27) {
    return weatherProfile("tab_beach_shore", [0, 2], [0.58, 0.34], "Warm day matched", "Open shore and a light coastal rhythm.", weather, strength);
  }
  return weatherProfile("tab_farm", [4, 2], [0.54, 0.34], "Clear day matched", "Field birds and a slow country morning.", weather, strength);
}
