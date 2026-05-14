import type { Conversation } from '../types/chat';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export const fetchConversations = async (token: string): Promise<Conversation[]> => {
  const response = await fetch(`${API_BASE_URL}/conversations`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Không thể tải danh sách hội thoại');
  }

  return await response.json() as Conversation[];
};

export const accessDirectConversation = async (token: string, friendId: number): Promise<{ id: number }> => {
  const response = await fetch(`${API_BASE_URL}/conversations/access/${friendId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Không thể mở đoạn chat');
  }

  return await response.json() as { id: number };
};
