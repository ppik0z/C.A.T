const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const DEFAULT_PRODUCTION_ORIGINS = new Set([
  'https://dangtuankhai.id.vn',
  'https://chat.dangtuankhai.id.vn',
]);

export const isTrustedAuthOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (process.env.NODE_ENV !== 'production' && LOCAL_HOSTNAMES.has(url.hostname)) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  return DEFAULT_PRODUCTION_ORIGINS.has(url.origin) || getConfiguredOrigins().includes(url.origin);
};

export const resolveCorsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
) => {
  callback(null, isTrustedAuthOrigin(origin));
};

const getConfiguredOrigins = () => {
  return (process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });
};
