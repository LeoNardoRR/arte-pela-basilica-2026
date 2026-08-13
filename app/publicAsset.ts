export function publicAsset(path: string) {
  const cleanPath = path.replace(/^\/+/, "");
  if (typeof document === "undefined") return `/${cleanPath}`;
  const configuredBase = document.querySelector<HTMLMetaElement>('meta[name="public-base"]')?.content || "/";
  const base = configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
  return `${base}${cleanPath}`;
}
