import type { ChatMessage } from '../types/chat';
import { apiBaseUrl } from '../config/api';
import { getAccessToken, handleUnauthorized, refreshAccessToken } from './session.runtime';

export const uploadMediaMessage = async (
  payload: {
    conversationId: number;
    file: File;
    caption?: string;
    clientTempId?: string;
    onProgress?: (progress: number) => void;
  },
): Promise<ChatMessage> => {
  return sendUpload(payload, false);
};

const sendUpload = (
  payload: Parameters<typeof uploadMediaMessage>[0],
  hasRetried: boolean,
): Promise<ChatMessage> => {
  return new Promise((resolve, reject) => {
    const token = getAccessToken();
    if (!token) {
      reject(new Error('Bạn cần đăng nhập để gửi file.'));
      return;
    }
    const formData = new FormData();
    formData.append('conversationId', payload.conversationId.toString());
    formData.append('file', payload.file);
    if (payload.caption) formData.append('caption', payload.caption);
    if (payload.clientTempId) formData.append('clientTempId', payload.clientTempId);

    const request = new XMLHttpRequest();
    request.open('POST', `${apiBaseUrl}/messages/media`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      payload.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = async () => {
      if (request.status === 401 && !hasRetried) {
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          sendUpload(payload, true).then(resolve, reject);
          return;
        }
        handleUnauthorized();
      }
      const responsePayload = parseJsonResponse(request.responseText);
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(getErrorMessage(responsePayload) ?? 'Không thể gửi file.'));
        return;
      }

      if (!responsePayload || 'message' in responsePayload) {
        reject(new Error('Không thể gửi file.'));
        return;
      }

      resolve(responsePayload as ChatMessage);
    };

    request.onerror = () => reject(new Error('Không thể gửi file.'));
    request.onabort = () => reject(new Error('Đã huỷ gửi file.'));
    request.send(formData);
  });
};

const parseJsonResponse = (value: string): { message?: string } | ChatMessage | null => {
  try {
    return JSON.parse(value) as { message?: string } | ChatMessage;
  } catch {
    return null;
  }
};

const getErrorMessage = (payload: { message?: string } | ChatMessage | null): string | null => {
  if (!payload || !('message' in payload)) return null;
  return payload.message ?? null;
};
