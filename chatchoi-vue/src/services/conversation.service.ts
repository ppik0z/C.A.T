import { apiRequest } from './apiClient';
import type { Conversation } from '../types/chat';

export const fetchConversations = () => apiRequest<Conversation[]>('/conversations');
export const accessDirectConversation = (friendId: number) => apiRequest<{ id: number }>(`/conversations/access/${friendId}`, { method: 'POST' });
export const createGroupConversation = (payload: { name: string; avatarGroup?: string | null; memberIds: number[] }) => apiRequest<Conversation>('/conversations/groups', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
});
export const fetchConversationDetail = (conversationId: number) => apiRequest<Conversation>(`/conversations/${conversationId}`);
export const updateConversation = (conversationId: number, payload: { name?: string; avatarGroup?: string | null }) => apiRequest<Conversation>(`/conversations/${conversationId}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
});
export const addConversationMembers = (conversationId: number, memberIds: number[]) => apiRequest<Conversation>(`/conversations/${conversationId}/members`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds }),
});
export const removeConversationMember = (conversationId: number, userId: number) => apiRequest<{ removed: boolean }>(`/conversations/${conversationId}/members/${userId}`, { method: 'DELETE' });
