import { apiBaseUrl } from '../config/api';
import type { CallHistoryItem, CallMediaToken, CallState } from '../types/call';

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

const parseResponse = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? fallback);
  }

  return await response.json() as T;
};

export const fetchActiveCalls = async (token: string): Promise<CallState[]> => {
  const response = await fetch(`${apiBaseUrl}/calls/active`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<CallState[]>(response, 'Không thể đồng bộ cuộc gọi');
};

export const fetchConversationActiveCall = async (token: string, conversationId: number): Promise<CallState | null> => {
  const response = await fetch(`${apiBaseUrl}/calls/conversations/${conversationId}/active`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<CallState | null>(response, 'Không thể tải trạng thái cuộc gọi');
};

export const fetchCallHistory = async (
  token: string,
  input: { conversationId?: number; limit?: number; beforeId?: number },
): Promise<CallHistoryItem[]> => {
  const params = new URLSearchParams();
  if (input.conversationId) params.set('conversationId', String(input.conversationId));
  if (input.limit) params.set('limit', String(input.limit));
  if (input.beforeId) params.set('beforeId', String(input.beforeId));

  const response = await fetch(`${apiBaseUrl}/calls/history?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<CallHistoryItem[]>(response, 'Không thể tải lịch sử cuộc gọi');
};

export const createCallMediaToken = async (token: string, callId: number): Promise<CallMediaToken> => {
  const response = await fetch(`${apiBaseUrl}/calls/${callId}/media-token`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  return parseResponse<CallMediaToken>(response, 'Không thể tạo token media cho cuộc gọi');
};
