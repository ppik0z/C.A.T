import { apiRequest } from './apiClient';
import type { NotificationListResponse } from '../types/notification';

export const fetchNotifications = (input: { limit?: number; beforeId?: number } = {}) => {
  const params = new URLSearchParams();
  if (input.limit) params.set('limit', String(input.limit));
  if (input.beforeId) params.set('beforeId', String(input.beforeId));
  const query = params.toString();
  return apiRequest<NotificationListResponse>(`/notifications${query ? `?${query}` : ''}`);
};

export const fetchUnreadCount = () => apiRequest<{ unreadCount: number }>('/notifications/unread-count');

export const markNotificationsRead = (input: { ids?: number[]; all?: boolean }) =>
  apiRequest<{ unreadCount: number }>('/notifications/read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

export const deleteNotification = (id: number) =>
  apiRequest<{ unreadCount: number }>(`/notifications/${id}`, { method: 'DELETE' });
