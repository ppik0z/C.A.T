export type PushNotificationType =
  | 'chat.message'
  | 'chat.mention'
  | 'friend.request'
  | 'friend.accept'
  | 'group.added'
  | 'group.removed'
  | 'call.incoming';

/**
 * Dữ liệu gửi qua FCM dạng data-only. FCM yêu cầu mọi giá trị là string,
 * nên payload luôn là Record<string, string>. Service worker / foreground
 * handler ở client sẽ tự render notification dựa trên các field này.
 */
export interface PushNotificationData {
  type: PushNotificationType;
  title: string;
  body: string;
  tag: string;
  link: string;
  icon?: string;
  conversationId?: string;
  messageId?: string;
  senderId?: string;
  senderName?: string;
  callId?: string;
  callKind?: string;
  /** Token cho phép service worker từ chối cuộc gọi khi app đã đóng. */
  declineToken?: string;
  /** '1' nếu người nhận tắt âm thông báo (notificationSound=false). */
  silent?: string;
}
