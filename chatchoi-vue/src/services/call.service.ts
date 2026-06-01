import { apiRequest } from './apiClient';
import type { CallHistoryItem, CallMediaToken, CallState } from '../types/call';

export const fetchActiveCalls = () => apiRequest<CallState[]>('/calls/active');
export const fetchConversationActiveCall = (conversationId: number) => apiRequest<CallState | null>(`/calls/conversations/${conversationId}/active`);
export const fetchCallHistory = (input: { conversationId?: number; limit?: number; beforeId?: number }) => {
  const params = new URLSearchParams();
  if (input.conversationId) params.set('conversationId', String(input.conversationId));
  if (input.limit) params.set('limit', String(input.limit));
  if (input.beforeId) params.set('beforeId', String(input.beforeId));
  return apiRequest<CallHistoryItem[]>(`/calls/history?${params.toString()}`);
};
export const createCallMediaToken = (callId: number) => apiRequest<CallMediaToken>(`/calls/${callId}/media-token`, { method: 'POST' });
