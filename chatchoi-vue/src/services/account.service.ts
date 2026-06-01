import { apiBaseUrl } from '../config/api';
import type { AccountMe, PublicUserProfile, UpdateProfileRequest } from '../types/account';

const authHeaders = (token: string, json = false) => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const parseResponse = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? fallback);
  }

  return await response.json() as T;
};

export const fetchAccountMe = async (token: string): Promise<AccountMe> => {
  const response = await fetch(`${apiBaseUrl}/account/me`, {
    headers: authHeaders(token),
  });
  return parseResponse<AccountMe>(response, 'Không thể tải thông tin tài khoản');
};

export const patchAccountProfile = async (token: string, input: UpdateProfileRequest): Promise<AccountMe> => {
  const response = await fetch(`${apiBaseUrl}/account/profile`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(input),
  });
  return parseResponse<AccountMe>(response, 'Không thể cập nhật hồ sơ');
};

export const uploadAccountAvatar = async (token: string, file: File): Promise<AccountMe> => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${apiBaseUrl}/account/avatar`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: formData,
  });
  return parseResponse<AccountMe>(response, 'Không thể cập nhật ảnh đại diện');
};

export const fetchPublicProfile = async (token: string, userId: number): Promise<PublicUserProfile> => {
  const response = await fetch(`${apiBaseUrl}/users/${userId}/profile`, {
    headers: authHeaders(token),
  });
  return parseResponse<PublicUserProfile>(response, 'Không thể tải hồ sơ người dùng');
};
