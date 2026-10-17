// The normal site uses local files. The optional single-file export supplies
// the same original assets as data URLs, without a server or external requests.
export function assetURL(path) {
  return window.APEX_OFFLINE_ASSETS?.[path] ?? `${import.meta.env.BASE_URL}${path}`;
}
