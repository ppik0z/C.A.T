const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const DEVELOPMENT_API_PROXY_PATH = '/api';

const normalizeBaseUrl = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_API_BASE_URL;

  const trimmedValue = value.trim();
  if (!trimmedValue) return DEFAULT_API_BASE_URL;

  return trimmedValue.replace(/\/+$/, '');
};

export const upstreamApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
export const apiBaseUrl = import.meta.env.DEV ? DEVELOPMENT_API_PROXY_PATH : upstreamApiBaseUrl;
export const socketBaseUrl = upstreamApiBaseUrl;
