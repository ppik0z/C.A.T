export type NotificationType =
  | 'friend.request'
  | 'friend.accept'
  | 'group.added'
  | 'group.removed'
  | 'chat.mention'
  | 'call.missed';

export type NotificationEntityType =
  | 'message'
  | 'call'
  | 'friendship'
  | 'conversation';

/** Dữ liệu phụ lưu dạng JSON trong cột metadata (mở rộng không cần migrate). */
export interface NotificationMetadata {
  link?: string;
  callKind?: string;
  mentionType?: string;
  groupName?: string;
  [key: string]: unknown;
}

/** Input để service tạo một thông báo. */
export interface CreateNotificationInput {
  userId: number;
  type: NotificationType;
  actorId?: number | null;
  conversationId?: number | null;
  entityType?: NotificationEntityType | null;
  entityId?: number | null;
  title: string;
  body: string;
  metadata?: NotificationMetadata | null;
}

/** Tóm tắt người gây ra thông báo (lấy tươi từ bảng users). */
export interface NotificationActor {
  id: number;
  displayName: string | null;
  avatar: string | null;
}

/** Thông báo đã chuẩn hoá trả về cho client. */
export interface NotificationDto {
  id: number;
  type: NotificationType | string;
  actor: NotificationActor | null;
  conversationId: number | null;
  title: string;
  body: string;
  link: string | null;
  metadata: NotificationMetadata | null;
  readAt: string | null;
  createdAt: string;
}

/** Kết quả danh sách kèm số chưa đọc cho lần tải đầu / phân trang. */
export interface NotificationListResult {
  items: NotificationDto[];
  unreadCount: number;
  hasMore: boolean;
}

/** Payload event nội bộ để gateway đẩy realtime. */
export interface NotificationCreatedEvent {
  userId: number;
  notification: NotificationDto;
}
