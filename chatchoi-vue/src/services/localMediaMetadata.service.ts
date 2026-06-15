export interface LocalMediaMetadata {
  width?: number;
  height?: number;
  durationSeconds?: number;
}

const METADATA_TIMEOUT_MS = 5_000;

export const inspectLocalMedia = async (
  file: File,
  objectUrl: string,
): Promise<LocalMediaMetadata> => {
  try {
    if (file.type.startsWith('image/')) {
      return await inspectImage(objectUrl);
    }

    if (file.type.startsWith('video/')) {
      return await inspectVideo(objectUrl);
    }
  } catch {
    // Metadata improves presentation but must never block an upload.
  }

  return {};
};

const inspectImage = (objectUrl: string): Promise<LocalMediaMetadata> => {
  return withTimeout(new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth || undefined,
      height: image.naturalHeight || undefined,
    });
    image.onerror = () => reject(new Error('Không thể đọc kích thước ảnh.'));
    image.src = objectUrl;
  }));
};

const inspectVideo = (objectUrl: string): Promise<LocalMediaMetadata> => {
  return withTimeout(new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const metadata = {
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
      };
      cleanup();
      resolve(metadata);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Không thể đọc thông tin video.'));
    };
    video.src = objectUrl;
  }));
};

const withTimeout = <T>(promise: Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Đọc thông tin media quá thời gian.'));
    }, METADATA_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
};
