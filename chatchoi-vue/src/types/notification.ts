export type PushNotificationType =
  | 'chat.message'
  | 'chat.mention'
  | 'friend.request'
  | 'friend.accept'
  | 'group.added'
  | 'group.removed';

/** Payload data-only nhận từ FCM (mọi field là string vì FCM ràng buộc vậy). */
export interface PushNotificationData {
  type?: PushNotificationType | string;
  title?: string;
  body?: string;
  tag?: string;
  link?: string;
  icon?: string;
  conversationId?: string;
  messageId?: string;
  senderId?: string;
  senderName?: string;
}

/** Thông báo đã chuẩn hoá để hiển thị in-app toast. */
export interface AppNotification {
  id: string;
  type: PushNotificationType | string;
  title: string;
  body: string;
  icon: string | null;
  link: string;
  conversationId: number | null;
}
