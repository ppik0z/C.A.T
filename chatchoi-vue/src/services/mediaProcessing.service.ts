const WEBP_QUALITY = 0.82;
const STATIC_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface ProcessedMediaFile {
  file: File;
  originalFileSizeBytes: number;
  compressedFileSizeBytes?: number;
}

export interface ProcessMediaOptions {
  onCompressionProgress?: (progress: number) => void;
}

export const shouldConvertToWebp = (file: File): boolean => {
  return STATIC_IMAGE_TYPES.has(file.type);
};

export const prepareMediaForUpload = async (
  file: File,
  options: ProcessMediaOptions = {},
): Promise<ProcessedMediaFile> => {
  if (!shouldConvertToWebp(file)) {
    return {
      file,
      originalFileSizeBytes: file.size,
    };
  }

  options.onCompressionProgress?.(10);
  const image = await loadImage(file);
  options.onCompressionProgress?.(55);

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Không thể chuyển ảnh sang WebP.');
  }

  context.drawImage(image, 0, 0);
  options.onCompressionProgress?.(80);

  let blob: Blob;
  try {
    blob = await canvasToWebpBlob(canvas);
  } finally {
    URL.revokeObjectURL(image.src);
  }
  options.onCompressionProgress?.(100);

  const webpFile = new File([blob], toWebpFileName(file.name), {
    type: 'image/webp',
    lastModified: Date.now(),
  });

  return {
    file: webpFile,
    originalFileSizeBytes: file.size,
    compressedFileSizeBytes: webpFile.size,
  };
};

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không thể chuyển ảnh sang WebP.'));
    };
    image.src = objectUrl;
  });
};

const canvasToWebpBlob = (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== 'image/webp') {
        reject(new Error('Không thể chuyển ảnh sang WebP.'));
        return;
      }

      resolve(blob);
    }, 'image/webp', WEBP_QUALITY);
  });
};

const toWebpFileName = (fileName: string): string => {
  const trimmedName = fileName.trim() || 'image';
  return trimmedName.replace(/\.[^.]+$/, '') + '.webp';
};
