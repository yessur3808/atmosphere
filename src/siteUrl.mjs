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
