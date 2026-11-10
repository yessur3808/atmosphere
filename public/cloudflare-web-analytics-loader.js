const excludedRegions = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "GB", "CH",
]);
const beaconSource = "https://static.cloudflareinsights.com/beacon.min.js";
const beaconToken = "c219499324d44a1eaae6d0a689627ddb";
const beaconSelector = 'script[src*="static.cloudflareinsights.com/beacon.min.js"]';

async function loadCloudflareWebAnalytics() {
  if (document.querySelector(beaconSelector)) return;

  try {
    const response = await fetch("/cdn-cgi/trace", {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) return;

    const trace = await response.text();
    const country = trace.match(/^loc=([A-Z]{2})$/m)?.[1] || "";
    if (!country || excludedRegions.has(country) || document.querySelector(beaconSelector)) return;

    const beacon = document.createElement("script");
    beacon.type = "module";
    beacon.src = beaconSource;
    beacon.dataset.cfBeacon = JSON.stringify({ token: beaconToken });
    document.head.append(beacon);
  } catch {
    // Fail closed: no country code means no analytics beacon.
  }
}

loadCloudflareWebAnalytics();
