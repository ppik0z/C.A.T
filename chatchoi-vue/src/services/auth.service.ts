import { apiRequest } from "./apiClient";

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

export const loginRequest = (input: LoginInput) =>
  apiRequest<AuthSessionResponse>("/auth/login", {
    method: "POST",
    auth: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const registerRequest = (input: RegisterInput) =>
  apiRequest<AuthSessionResponse>("/auth/register", {
    method: "POST",
    auth: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const refreshSessionRequest = () =>
  apiRequest<AuthSessionResponse>("/auth/refresh", {
    method: "POST",
    auth: false,
    retryOnUnauthorized: false,
  });

export const logoutRequest = () =>
  apiRequest<{ message: string }>("/auth/logout", {
    method: "POST",
    auth: false,
    retryOnUnauthorized: false,
  });

export const logoutAllRequest = () =>
  apiRequest<{ message: string }>("/auth/logout-all", {
    method: "POST",
  });

export const forgotPasswordRequest = (email: string) =>
  apiRequest<{ message: string }>("/auth/password/forgot", {
    method: "POST",
    auth: false,
    retryOnUnauthorized: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

export const resetPasswordRequest = (token: string, newPassword: string) =>
  apiRequest<{ message: string }>("/auth/password/reset", {
    method: "POST",
    auth: false,
    retryOnUnauthorized: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });

export const verifyEmailRequest = (token: string) =>
  apiRequest<{ message: string }>("/auth/email/verify", {
    method: "POST",
    auth: false,
    retryOnUnauthorized: false,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

export const requestEmailVerification = () =>
  apiRequest<{ message: string }>("/auth/email/verification/request", {
    method: "POST",
  });
