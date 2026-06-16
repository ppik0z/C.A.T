export type PushNotificationType =
  | 'chat.message'
  | 'chat.mention'
  | 'friend.request'
  | 'friend.accept'
  | 'group.added'
  | 'group.removed'
  | 'call.incoming'
  | 'call.missed';

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
  callId?: string;
  callKind?: string;
  declineToken?: string;
  silent?: string;
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
  silent?: boolean;
}

/** Người gây ra thông báo (lấy tươi từ server). */
export interface NotificationActor {
  id: number;
  displayName: string | null;
  avatar: string | null;
}

/** Thông báo bền vững từ trung tâm thông báo (lưu server-side). */
export interface NotificationItem {
  id: number;
  type: PushNotificationType | string;
  actor: NotificationActor | null;
  conversationId: number | null;
  title: string;
  body: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

/** Kết quả trả về của GET /notifications. */
export interface NotificationListResponse {
  items: NotificationItem[];
  unreadCount: number;
  hasMore: boolean;
}
