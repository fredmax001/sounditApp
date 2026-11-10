/**
 * Video Thumbnail Extractor
 * Extracts a high-quality frame from a video file as a Blob/File and JPEG dataURL
 * to guarantee that reels always use a frame from the actual video instead of any stock image.
 */

export interface VideoThumbnailResult {
  blob: Blob;
  dataUrl: string;
  file: File;
}

export function extractVideoThumbnail(
  videoFile: File,
  seekTimeSeconds: number = 0.5
): Promise<VideoThumbnailResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    const objectUrl = URL.createObjectURL(videoFile);
    video.src = objectUrl;

    let hasCleanedUp = false;
    const cleanup = () => {
      if (!hasCleanedUp) {
        hasCleanedUp = true;
        try {
          URL.revokeObjectURL(objectUrl);
        } catch {
          // ignore
        }
      }
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Video thumbnail extraction timed out'));
    }, 12000);

    video.onloadedmetadata = () => {
      const targetTime = Math.min(
        seekTimeSeconds,
        video.duration > 0 ? video.duration / 2 : 0.1
      );
      video.currentTime = targetTime;
    };

    video.onseeked = () => {
      clearTimeout(timeoutId);
      try {
        const width = video.videoWidth || 720;
        const height = video.videoHeight || 1280;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas 2D context not available'));
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            cleanup();
            if (!blob) {
              reject(new Error('Failed to create thumbnail blob'));
              return;
            }
            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            const thumbFile = new File(
              [blob],
              `thumbnail_${Date.now()}.jpg`,
              { type: 'image/jpeg' }
            );
            resolve({ blob, dataUrl, file: thumbFile });
          },
          'image/jpeg',
          0.88
        );
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = (e) => {
      clearTimeout(timeoutId);
      cleanup();
      reject(e);
    };
  });
}
