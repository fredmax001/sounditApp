/**
 * Returns the proper web base URL for the Sound It platform.
 * In the Capacitor app, window.location.origin is the local app origin
 * (capacitor://localhost or http://localhost), so we must use the
 * production web domain for any shareable links or QR codes.
 */
export const WEB_ORIGIN = import.meta.env.VITE_WEB_ORIGIN || window.location.origin || 'https://sounditent.com';

export function getWebUrl(path: string = ''): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${WEB_ORIGIN}${cleanPath}`;
}
