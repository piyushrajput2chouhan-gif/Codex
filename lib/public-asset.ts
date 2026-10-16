/** Resolve supplied media beneath Vite's base, including GitHub project sites. */
export function publicAsset(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
