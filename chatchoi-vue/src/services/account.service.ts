import { apiRequest } from './apiClient';
import type { AccountMe, PublicUserProfile, UpdateProfileRequest } from '../types/account';

export const fetchAccountMe = () => apiRequest<AccountMe>('/account/me');

export const patchAccountProfile = (input: UpdateProfileRequest) => apiRequest<AccountMe>('/account/profile', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input),
});

export const uploadAccountAvatar = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiRequest<AccountMe>('/account/avatar', { method: 'PUT', body: formData });
};

export const fetchPublicProfile = (userId: number) => apiRequest<PublicUserProfile>(`/users/${userId}/profile`);
