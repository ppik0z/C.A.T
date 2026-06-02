const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);
const TRUSTED_DOMAIN = 'dangtuankhai.id.vn';

export const isTrustedAuthOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (LOCAL_HOSTNAMES.has(url.hostname)) {
    return url.protocol === 'http:' || url.protocol === 'https:';
  }

  const isTrustedDomain = url.hostname === TRUSTED_DOMAIN || url.hostname.endsWith(`.${TRUSTED_DOMAIN}`);
  if (isTrustedDomain && url.protocol === 'https:') return true;

  return getConfiguredOrigins().includes(url.origin);
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
