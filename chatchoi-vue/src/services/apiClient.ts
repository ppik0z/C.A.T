import { apiBaseUrl } from '../config/api';
import { getAccessToken, handleUnauthorized, refreshAccessToken } from './session.runtime';

export interface ApiRequestOptions extends RequestInit {
  auth?: boolean;
  retryOnUnauthorized?: boolean;
}

interface ApiErrorPayload {
  message?: string | string[];
  code?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const isAuthenticationError = (error: unknown): error is ApiError => {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
};

export const apiRequest = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  let response: Response;
  try {
    response = await request(path, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.', 0);
  }

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
    const payload = await response.json().catch(() => null) as ApiErrorPayload | null;
    const message = Array.isArray(payload?.message) ? payload.message.join(' ') : payload?.message;
    throw new ApiError(message ?? 'Không thể xử lý yêu cầu.', response.status, payload?.code);
  }
  return await response.json() as T;
};
