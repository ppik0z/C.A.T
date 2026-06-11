import { apiRequest } from './apiClient';

export interface AuthSessionResponse {
  accessToken: string;
  expiresInSeconds: number;
}

export interface RegisterInput {
  username: string;
  email: string;
  displayName?: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export const loginRequest = (input: LoginInput) => apiRequest<AuthSessionResponse>('/auth/login', {
  method: 'POST',
  auth: false,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input),
});

export const registerRequest = (input: RegisterInput) => apiRequest<AuthSessionResponse>('/auth/register', {
  method: 'POST',
  auth: false,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input),
});

export const refreshSessionRequest = () => apiRequest<AuthSessionResponse>('/auth/refresh', {
  method: 'POST',
  auth: false,
  retryOnUnauthorized: false,
});

export const logoutRequest = () => apiRequest<{ message: string }>('/auth/logout', {
  method: 'POST',
  auth: false,
  retryOnUnauthorized: false,
});

export const logoutAllRequest = () => apiRequest<{ message: string }>('/auth/logout-all', {
  method: 'POST',
});
