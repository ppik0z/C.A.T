import { subscribeForegroundPush } from './push-notifications.service';
import { useNotificationToastsStore } from '../stores/notification-toasts';
import { useChatStore } from '../stores/chat';
import { dispatchPushNavigation } from '../pwa/pwaRuntime';
import type { AppNotification, PushNotificationData } from '../types/notification';

let unsubscribe: (() => void) | null = null;

const CHAT_TYPES = new Set(['chat.message', 'chat.mention']);

const toAppNotification = (data: PushNotificationData): AppNotification => {
  const conversationId = data.conversationId ? Number(data.conversationId) : Number.NaN;
  return {
    id: crypto.randomUUID(),
    type: data.type ?? 'chat.message',
    title: data.title || 'ChatChoi',
    body: data.body || 'Bạn có thông báo mới.',
    icon: data.icon || null,
    link: data.link || '/',
    conversationId: Number.isInteger(conversationId) && conversationId > 0 ? conversationId : null,
  };
};

const isViewingConversation = (conversationId: number | null) => {
  if (!conversationId) return false;
  const chatStore = useChatStore();
  const focused = document.visibilityState === 'visible' && document.hasFocus();
  return focused && chatStore.currentConversationId === conversationId;
};

const showOsNotification = (notification: AppNotification) => {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;

  void navigator.serviceWorker.ready.then((registration) => {
    void registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon || '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      tag: `${notification.type}:${notification.conversationId ?? notification.id}`,
      data: {
        type: notification.type,
        conversationId: notification.conversationId ? String(notification.conversationId) : null,
        link: notification.link,
      },
    });
  });
};

const handleForegroundData = (data: PushNotificationData) => {
  const notification = toAppNotification(data);

  // Tin nhắn của đúng đoạn chat đang mở & đang focus thì bỏ qua: người dùng đã thấy.
  if (CHAT_TYPES.has(notification.type) && isViewingConversation(notification.conversationId)) {
    return;
  }

  useNotificationToastsStore().push(notification);
  showOsNotification(notification);
};

export const startForegroundNotifications = () => {
  if (unsubscribe) return;
  try {
    unsubscribe = subscribeForegroundPush(handleForegroundData);
  } catch (error) {
    console.error('Không thể lắng nghe thông báo foreground.', error);
  }
};

export const stopForegroundNotifications = () => {
  unsubscribe?.();
  unsubscribe = null;
};

/** Điều hướng khi người dùng bấm vào một toast trong app. */
export const openNotification = (notification: AppNotification) => {
  dispatchPushNavigation(notification.link, notification.conversationId ? String(notification.conversationId) : null);
};
