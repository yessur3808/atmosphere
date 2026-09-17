const forecastEndpoint = "https://api.open-meteo.com/v1/forecast";

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
    current: "temperature_2m,apparent_temperature,weather_code,is_day",
    temperature_unit: "celsius",
    timezone: "auto",
    forecast_days: "1",
  }).toString();
  return url.toString();
}

export function parseCurrentWeather(payload) {
  const current = payload?.current;
  const temperature = Number(current?.temperature_2m);
  const apparentTemperature = Number(current?.apparent_temperature);
  const weatherCode = Number(current?.weather_code);
  if (!Number.isFinite(temperature) || !Number.isFinite(weatherCode)) {
    throw new TypeError("Weather response is missing current conditions");
  }

  return {
    temperature: Math.round(temperature),
    apparentTemperature: Number.isFinite(apparentTemperature) ? Math.round(apparentTemperature) : undefined,
    unit: payload?.current_units?.temperature_2m || "°C",
    observedAt: current.time || "",
    ...weatherConditionForCode(weatherCode, Number(current.is_day) !== 0),
  };
}
