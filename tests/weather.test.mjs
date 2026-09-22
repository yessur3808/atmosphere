import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCitySearchUrl,
  buildCurrentWeatherUrl,
  parseCitySearch,
  parseCurrentWeather,
  roundedWeatherCoordinates,
  weatherAtmosphereProfile,
  weatherConditionForCode,
} from "../src/weather.mjs";

test("weather conditions map WMO codes to calm interface labels", () => {
  assert.deepEqual(weatherConditionForCode(0, true), { label: "Clear", icon: "sun" });
  assert.deepEqual(weatherConditionForCode(0, false), { label: "Clear night", icon: "moon" });
  assert.deepEqual(weatherConditionForCode(63), { label: "Rain", icon: "rain" });
  assert.deepEqual(weatherConditionForCode(95), { label: "Thunderstorm", icon: "storm" });
});

test("weather coordinates are reduced before they leave the browser", () => {
  assert.deepEqual(roundedWeatherCoordinates(22.3193039, 114.1693611), { latitude: 22.32, longitude: 114.17 });
  assert.throws(() => roundedWeatherCoordinates(91, 0), RangeError);
  assert.throws(() => roundedWeatherCoordinates(0, -181), RangeError);
});

test("current weather requests contain only the required rounded location and fields", () => {
  const url = new URL(buildCurrentWeatherUrl(22.3193039, 114.1693611));
  assert.equal(url.origin, "https://api.open-meteo.com");
  assert.equal(url.searchParams.get("latitude"), "22.32");
  assert.equal(url.searchParams.get("longitude"), "114.17");
  assert.equal(url.searchParams.get("current"), "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,rain,snowfall,weather_code,cloud_cover,wind_speed_10m,is_day");
  assert.equal(url.searchParams.get("forecast_days"), "1");
});

test("manual city lookup stays on Open-Meteo and returns rounded coordinates", () => {
  const url = new URL(buildCitySearchUrl("Hong Kong"));
  assert.equal(url.origin, "https://geocoding-api.open-meteo.com");
  assert.equal(url.searchParams.get("name"), "Hong Kong");
  assert.deepEqual(parseCitySearch({ results: [{ name: "Hong Kong", country: "Hong Kong", latitude: 22.3193, longitude: 114.1694 }] }), {
    latitude: 22.32,
    longitude: 114.17,
    label: "Hong Kong, Hong Kong",
  });
  assert.throws(() => buildCitySearchUrl(" "), RangeError);
  assert.throws(() => parseCitySearch({ results: [] }), TypeError);
});

test("current weather responses become concise display data", () => {
  assert.deepEqual(parseCurrentWeather({
    current: { temperature_2m: 24.6, apparent_temperature: 26.2, relative_humidity_2m: 78, precipitation: 0.2, rain: 0.2, snowfall: 0, weather_code: 2, cloud_cover: 64, wind_speed_10m: 18.4, is_day: 1, time: "2026-09-17T20:45" },
    current_units: { temperature_2m: "°C", wind_speed_10m: "km/h", precipitation: "mm" },
    timezone: "Asia/Hong_Kong",
  }), {
    temperature: 25,
    apparentTemperature: 26,
    humidity: 78,
    precipitation: 0.2,
    rain: 0.2,
    snowfall: 0,
    windSpeed: 18,
    cloudCover: 64,
    weatherCode: 2,
    isDay: true,
    unit: "°C",
    windUnit: "km/h",
    precipitationUnit: "mm",
    observedAt: "2026-09-17T20:45",
    locationLabel: "Hong Kong",
    label: "Partly cloudy",
    icon: "partly-cloudy",
  });
});

test("live weather maps conditions to semantically matching scenes and layered sound", () => {
  const rainyNight = weatherAtmosphereProfile({ label: "Rain", icon: "rain", isDay: false, weatherCode: 63, temperature: 19, precipitation: 1.4 });
  assert.equal(rainyNight.sceneId, "tab_rainy_bedroom");
  assert.deepEqual(rainyNight.indices, [0, 1, 3]);

  const storm = weatherAtmosphereProfile({ label: "Thunderstorm", icon: "storm", isDay: true, weatherCode: 95, temperature: 25 });
  assert.equal(storm.sceneId, "tab_lightning");
  assert.ok(storm.indices.length >= 3);

  const windy = weatherAtmosphereProfile({ label: "Clear", icon: "sun", isDay: true, weatherCode: 0, temperature: 20, windSpeed: 34 });
  assert.equal(windy.sceneId, "tab_wind");

  const warm = weatherAtmosphereProfile({ label: "Clear", icon: "sun", isDay: true, weatherCode: 0, temperature: 31, windSpeed: 8 });
  assert.equal(warm.sceneId, "tab_beach_shore");
});

test("comfort mode deliberately chooses shelter instead of mirroring a storm", () => {
  const profile = weatherAtmosphereProfile(
    { label: "Thunderstorm", icon: "storm", isDay: false, weatherCode: 95, temperature: 18 },
    { mode: "comfort", strength: "subtle" },
  );
  assert.equal(profile.sceneId, "tab_rainy_bedroom");
  assert.match(profile.title, /Shelter/);
  assert.ok(profile.volumes.every((volume) => volume > 0 && volume <= 1));
});
