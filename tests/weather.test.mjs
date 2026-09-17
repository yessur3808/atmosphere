import assert from "node:assert/strict";
import test from "node:test";
import { buildCurrentWeatherUrl, parseCurrentWeather, roundedWeatherCoordinates, weatherConditionForCode } from "../src/weather.mjs";

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
  assert.equal(url.searchParams.get("current"), "temperature_2m,apparent_temperature,weather_code,is_day");
  assert.equal(url.searchParams.get("forecast_days"), "1");
});

test("current weather responses become concise display data", () => {
  assert.deepEqual(parseCurrentWeather({
    current: { temperature_2m: 24.6, apparent_temperature: 26.2, weather_code: 2, is_day: 1, time: "2026-09-17T20:45" },
    current_units: { temperature_2m: "°C" },
  }), {
    temperature: 25,
    apparentTemperature: 26,
    unit: "°C",
    observedAt: "2026-09-17T20:45",
    label: "Partly cloudy",
    icon: "partly-cloudy",
  });
});
