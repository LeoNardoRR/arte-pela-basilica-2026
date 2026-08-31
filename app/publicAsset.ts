function resolvePublicBase() {
  const metaBase = document.querySelector<HTMLMetaElement>('meta[name="public-base"]')?.content;
  const configuredBase = metaBase && metaBase !== "%BASE_URL%" ? metaBase : import.meta.env.BASE_URL || "/";
  return configuredBase.endsWith("/") ? configuredBase : `${configuredBase}/`;
}

export function publicAsset(path: string) {
  const cleanPath = path.replace(/^\/+/, "");
  if (typeof document === "undefined") return `/${cleanPath}`;
  return `${resolvePublicBase()}${cleanPath}`;
}
