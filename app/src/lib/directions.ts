export type MapProvider = 'google' | 'apple' | 'amap';

export function getDirectionsUrl(
  lat: number,
  lng: number,
  name?: string,
  provider: MapProvider = 'google'
): string {
  const encodedName = name ? encodeURIComponent(name) : '';

  switch (provider) {
    case 'google':
      // Universal Google Maps URL that opens app on mobile, web on desktop
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${encodedName ? `&destination_place_id=${encodedName}` : ''}`;
    case 'apple':
      // Apple Maps URL scheme (works on iOS and macOS)
      return `http://maps.apple.com/?daddr=${lat},${lng}${encodedName ? `&q=${encodedName}` : ''}`;
    case 'amap':
      // Amap (Gaode) URL scheme for China
      return `https://uri.amap.com/navigation?to=${lng},${lat},${encodedName || 'Destination'}&mode=car&policy=1`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
}

export function openDirections(lat: number, lng: number, name?: string, preferredProvider?: MapProvider) {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);

  // Determine best default provider
  let provider = preferredProvider;
  if (!provider) {
    if (isWeChat || navigator.language.startsWith('zh')) {
      provider = 'amap';
    } else if (isIOS) {
      provider = 'apple';
    } else {
      provider = 'google';
    }
  }

  const url = getDirectionsUrl(lat, lng, name, provider);
  window.open(url, '_blank', 'noopener,noreferrer');
}
