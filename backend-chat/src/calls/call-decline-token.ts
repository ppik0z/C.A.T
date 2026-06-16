import { createHmac, timingSafeEqual } from 'crypto';

// Token ký HMAC (không trạng thái) cho phép service worker từ chối ĐÚNG cuộc gọi
// của ĐÚNG người nhận mà không cần session — dùng khi app đã đóng (auth là Bearer
// nên SW không có access token). Token gắn chặt callId + userId + hạn dùng.

const PURPOSE = 'call-decline';
const TTL_MS = 5 * 60 * 1000;

const getSecret = () => process.env.JWT_SECRET ?? '';

const sign = (payload: string) => createHmac('sha256', getSecret()).update(payload).digest('base64url');

export const signCallDeclineToken = (callId: number, userId: number): string => {
  const expiresAt = Date.now() + TTL_MS;
  const signature = sign(`${PURPOSE}.${callId}.${userId}.${expiresAt}`);
  return Buffer.from(`${callId}.${userId}.${expiresAt}.${signature}`).toString('base64url');
};

export const verifyCallDeclineToken = (token: string): { callId: number; userId: number } | null => {
  try {
    const [callIdRaw, userIdRaw, expiresRaw, signature] = Buffer.from(token, 'base64url')
      .toString('utf8')
      .split('.');
    const callId = Number(callIdRaw);
    const userId = Number(userIdRaw);
    const expiresAt = Number(expiresRaw);

    if (![callId, userId, expiresAt].every(Number.isInteger) || !signature) return null;
    if (expiresAt < Date.now()) return null;

    const expected = sign(`${PURPOSE}.${callId}.${userId}.${expiresAt}`);
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (actualBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

    return { callId, userId };
  } catch {
    return null;
  }
};
