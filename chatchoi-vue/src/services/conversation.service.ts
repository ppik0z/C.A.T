import { apiRequest } from './apiClient';
import type { Conversation } from '../types/chat';

export const fetchConversations = () => apiRequest<Conversation[]>('/conversations');
export const accessDirectConversation = (friendId: number) => apiRequest<{ id: number }>(`/conversations/access/${friendId}`, { method: 'POST' });
export const createGroupConversation = (payload: {
  name: string;
  description?: string | null;
  avatar?: File | null;
  memberIds: number[];
}) => {
  const formData = new FormData();
  formData.append('name', payload.name);
  formData.append('description', payload.description ?? '');
  formData.append('memberIds', JSON.stringify(payload.memberIds));
  if (payload.avatar) formData.append('avatar', payload.avatar);
  return apiRequest<Conversation>('/conversations/groups', {
    method: 'POST',
    body: formData,
  });
};
export const fetchConversationDetail = (conversationId: number) => apiRequest<Conversation>(`/conversations/${conversationId}`);
export const updateConversation = (conversationId: number, payload: {
  name?: string;
  description?: string | null;
  avatar?: File | null;
}) => {
  const formData = new FormData();
  if (payload.name !== undefined) formData.append('name', payload.name);
  if (payload.description !== undefined) formData.append('description', payload.description ?? '');
  if (payload.avatar) formData.append('avatar', payload.avatar);
  return apiRequest<Conversation>(`/conversations/${conversationId}`, {
    method: 'PATCH',
    body: formData,
  });
};
export const addConversationMembers = (conversationId: number, memberIds: number[]) => apiRequest<Conversation>(`/conversations/${conversationId}/members`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds }),
});
export const removeConversationMember = (conversationId: number, userId: number) => apiRequest<{ removed: boolean }>(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' });

// durationMinutes: null = bật lại; 0 = tắt cho đến khi bật lại; > 0 = tắt trong N phút.
export const updateConversationNotifications = (conversationId: number, durationMinutes: number | null) => apiRequest<Conversation>(`/conversations/${conversationId}/notifications`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ durationMinutes }),
});
