const localDevApiKey = import.meta.env.DEV
  ? import.meta.env.PUBLIC_CARTO_API_KEY?.trim()
  : undefined;

/** Add the optional local-development API key to a CARTO basemap URL. */
export function cartoTileUrl(url: string): string {
  if (!localDevApiKey) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(localDevApiKey)}`;
}
