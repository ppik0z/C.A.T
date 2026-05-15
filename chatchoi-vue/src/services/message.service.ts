import type { ChatMessage } from '../types/chat';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

const parseResponse = async <T>(response: Response, fallback: string): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message ?? fallback);
  }

  return await response.json() as T;
};

export const uploadMediaMessage = async (
  token: string,
  payload: {
    conversationId: number;
    file: File;
    caption?: string;
    clientTempId?: string;
  },
): Promise<ChatMessage> => {
  const formData = new FormData();
  formData.append('conversationId', payload.conversationId.toString());
  formData.append('file', payload.file);

  if (payload.caption) formData.append('caption', payload.caption);
  if (payload.clientTempId) formData.append('clientTempId', payload.clientTempId);

  const response = await fetch(`${API_BASE_URL}/messages/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return parseResponse<ChatMessage>(response, 'Không thể gửi file.');
};
