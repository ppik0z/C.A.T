const DEFAULT_API_BASE_URL = 'http://localhost:3000';

const normalizeBaseUrl = (value: unknown): string => {
  if (typeof value !== 'string') return DEFAULT_API_BASE_URL;

  const trimmedValue = value.trim();
  if (!trimmedValue) return DEFAULT_API_BASE_URL;

  return trimmedValue.replace(/\/+$/, '');
};

export const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
