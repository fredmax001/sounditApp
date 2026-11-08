/**
 * Returns the proper web base URL for the Sound It platform.
 * In the Capacitor app, window.location.origin is the local app origin
 * (capacitor://localhost or http://localhost), so we must use the
 * production web domain for any shareable links or QR codes.
 */
const isNativeApp = typeof window !== 'undefined' &&
  Boolean((window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

export const WEB_ORIGIN = import.meta.env.VITE_WEB_ORIGIN ||
  (isNativeApp ? 'https://sounditent.com' : window.location.origin || 'https://sounditent.com');

export function getWebUrl(path: string = ''): string {
  return new URL(path.startsWith('/') ? path : `/${path}`, WEB_ORIGIN).toString();
}

/** Resolve API-provided media paths against the website, never the native WebView origin. */
export function getMediaUrl(url?: string | null): string {
  if (!url) return '';
  try {
    return new URL(url, WEB_ORIGIN).toString();
  } catch {
    return url;
  }
}
