export const desktopMediaRoot = "https://yessur3808.github.io/atmosphere/";

export function isTauriRuntime(scope = typeof window !== "undefined" ? window : undefined) {
  return Boolean(scope?.__TAURI_INTERNALS__);
}

export function resolveSiteUrl(path, baseHref) {
  if (path == null) return "";
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return path;

  const documentBase = baseHref
    || (typeof document !== "undefined" ? document.baseURI : "http://localhost/");
  const siteRoot = new URL(".", documentBase);
  return new URL(String(path).replace(/^\/+/, ""), siteRoot).href;
}

export function siteUrl(path = "") {
  return resolveSiteUrl(path);
}

export function resolveMediaUrl(path, baseHref, nativeRuntime = isTauriRuntime()) {
  if (path == null) return "";
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return path;
  if (!nativeRuntime) return resolveSiteUrl(path, baseHref);
  return new URL(String(path).replace(/^\/+/, ""), desktopMediaRoot).href;
}

export function mediaUrl(path = "") {
  return resolveMediaUrl(path);
}
