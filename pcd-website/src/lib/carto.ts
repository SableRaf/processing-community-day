const CARTO_API_KEY = import.meta.env.PUBLIC_CARTO_API_KEY;

/** Build a CARTO raster tile URL, adding the public API key when configured. */
export function cartoTileUrl(stylePath: string): string {
  const baseUrl = `https://{s}.basemaps.cartocdn.com/${stylePath}/{z}/{x}/{y}{r}.png`;
  return CARTO_API_KEY
    ? `${baseUrl}?key=${encodeURIComponent(CARTO_API_KEY)}`
    : baseUrl;
}
