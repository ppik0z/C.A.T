import { Injectable } from '@nestjs/common';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message } from 'firebase-admin/messaging';

export interface FcmPushMessage {
  token: string;
  data: Record<string, string>;
}

export interface FcmPushResult {
  invalidTokens: string[];
  failureCount: number;
  successCount: number;
}

const FCM_BATCH_LIMIT = 500;
const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

@Injectable()
export class FcmPushProvider {
  constructor() {
    if (getApps().length === 0) {
      initializeApp({ credential: applicationDefault() });
    }
  }

  async send(messages: FcmPushMessage[]): Promise<FcmPushResult> {
    const result: FcmPushResult = { invalidTokens: [], failureCount: 0, successCount: 0 };

    for (let offset = 0; offset < messages.length; offset += FCM_BATCH_LIMIT) {
      const batch = messages.slice(offset, offset + FCM_BATCH_LIMIT);
      const response = await getMessaging().sendEach(batch.map((message): Message => ({
        token: message.token,
        data: message.data,
        webpush: {
          headers: {
            Urgency: 'high',
          },
        },
      })));

      result.failureCount += response.failureCount;
      result.successCount += response.successCount;
      response.responses.forEach((item, index) => {
        if (!item.success && item.error && INVALID_TOKEN_CODES.has(item.error.code)) {
          result.invalidTokens.push(batch[index].token);
        }
      });
    }

    return result;
  }
}
