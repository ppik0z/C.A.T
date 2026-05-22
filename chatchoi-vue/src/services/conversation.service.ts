import type { Conversation } from '../types/chat';
import { apiBaseUrl } from '../config/api';

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

export const fetchConversations = async (token: string): Promise<Conversation[]> => {
  const response = await fetch(`${apiBaseUrl}/conversations`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<Conversation[]>(response, 'Không thể tải danh sách hội thoại');
};

export const accessDirectConversation = async (token: string, friendId: number): Promise<{ id: number }> => {
  const response = await fetch(`${apiBaseUrl}/conversations/access/${friendId}`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  return parseResponse<{ id: number }>(response, 'Không thể mở đoạn chat');
};

export const createGroupConversation = async (
  token: string,
  payload: { name: string; avatarGroup?: string | null; memberIds: number[] },
): Promise<Conversation> => {
  const response = await fetch(`${apiBaseUrl}/conversations/groups`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });

  return parseResponse<Conversation>(response, 'Không thể tạo nhóm');
};

export const fetchConversationDetail = async (token: string, conversationId: number): Promise<Conversation> => {
  const response = await fetch(`${apiBaseUrl}/conversations/${conversationId}`, {
    method: 'GET',
    headers: authHeaders(token),
  });

  return parseResponse<Conversation>(response, 'Không thể tải thông tin nhóm');
};

export const updateConversation = async (
  token: string,
  conversationId: number,
  payload: { name?: string; avatarGroup?: string | null },
): Promise<Conversation> => {
  const response = await fetch(`${apiBaseUrl}/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: authHeaders(token, true),
    body: JSON.stringify(payload),
  });

  return parseResponse<Conversation>(response, 'Không thể cập nhật nhóm');
};

export const addConversationMembers = async (
  token: string,
  conversationId: number,
  memberIds: number[],
): Promise<Conversation> => {
  const response = await fetch(`${apiBaseUrl}/conversations/${conversationId}/members`, {
    method: 'POST',
    headers: authHeaders(token, true),
    body: JSON.stringify({ memberIds }),
  });

  return parseResponse<Conversation>(response, 'Không thể thêm thành viên');
};

export const removeConversationMember = async (
  token: string,
  conversationId: number,
  userId: number,
): Promise<{ removed: boolean }> => {
  const response = await fetch(`${apiBaseUrl}/conversations/${conversationId}/members/${userId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  return parseResponse<{ removed: boolean }>(response, 'Không thể xoá thành viên');
};
