import { apiBaseUrl } from '../config/api';
import { getAccessToken, handleUnauthorized, refreshAccessToken } from './session.runtime';

export interface ApiRequestOptions extends RequestInit {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

export const apiRequest = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const response = await request(path, options);
  if (response.status === 401 && options.auth !== false && options.retryOnUnauthorized !== false) {
    const token = await refreshAccessToken();
    if (token) {
      return parseResponse<T>(await request(path, { ...options, retryOnUnauthorized: false }));
    }
    handleUnauthorized();
  }
  return parseResponse<T>(response);
};

const request = (path: string, options: ApiRequestOptions) => {
  const headers = new Headers(options.headers);
  const token = getAccessToken();
  if (options.auth !== false && token) headers.set('Authorization', `Bearer ${token}`);

  return fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = Array.isArray(payload?.message) ? payload.message.join(' ') : payload?.message;
    throw new Error(message ?? 'Không thể xử lý yêu cầu.');
  }
  return await response.json() as T;
};
