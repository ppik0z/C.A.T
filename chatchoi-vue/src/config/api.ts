const DEVELOPMENT_API_PROXY_PATH = '/api';

const normalizeBaseUrl = (value: unknown): string => {
  if (typeof value !== 'string') return '';

  const trimmedValue = value.trim();
  if (!trimmedValue) return '';

  return trimmedValue.replace(/\/+$/, '');
};

export const upstreamApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
export const apiBaseUrl = import.meta.env.DEV
  ? DEVELOPMENT_API_PROXY_PATH
  : upstreamApiBaseUrl || DEVELOPMENT_API_PROXY_PATH;
export const socketBaseUrl = upstreamApiBaseUrl.startsWith('http')
  ? upstreamApiBaseUrl
  : window.location.origin;
