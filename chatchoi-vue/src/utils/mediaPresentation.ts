export const getMediaAspectRatio = (
  width: number | null | undefined,
  height: number | null | undefined,
  fallback = 4 / 3,
) => {
  if (!width || !height || width <= 0 || height <= 0) return fallback;
  return width / height;
};

export const formatMediaDuration = (durationSeconds: number | null | undefined) => {
  if (!durationSeconds || durationSeconds < 1) return '';

  const totalSeconds = Math.floor(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
      .join(':');
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};
