/**
 * Utility to save / download an image directly to the user's device (phone or computer).
 * Works across desktop browsers, iOS Safari, Android Chrome, and PWA/Capacitor.
 */
export async function saveImageToDevice(imageUrl: string, suggestedFilename?: string): Promise<boolean> {
  if (!imageUrl) return false;

  const defaultExt = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
  const cleanName = suggestedFilename
    ? (suggestedFilename.includes('.') ? suggestedFilename : `${suggestedFilename}.${defaultExt}`)
    : `soundit-photo-${Date.now()}.${defaultExt}`;

  try {
    // Attempt blob download to ensure real save on mobile and desktop
    const res = await fetch(imageUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = cleanName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);
      return true;
    }
  } catch (err) {
    // CORS or network error — fall back to opening direct link
    console.warn('Blob fetch failed, falling back to direct anchor download', err);
  }

  try {
    const anchor = document.createElement('a');
    anchor.href = imageUrl;
    anchor.download = cleanName;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    return true;
  } catch (err) {
    console.error('Failed to trigger download', err);
    window.open(imageUrl, '_blank');
    return false;
  }
}
