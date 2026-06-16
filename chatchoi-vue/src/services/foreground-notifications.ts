import { subscribeForegroundPush } from './push-notifications.service';
import { useNotificationToastsStore } from '../stores/notification-toasts';
import { useChatStore } from '../stores/chat';
import { dispatchPushNavigation } from '../pwa/pwaRuntime';
import type { AppNotification, PushNotificationData } from '../types/notification';

let unsubscribe: (() => void) | null = null;

const CHAT_TYPES = new Set(['chat.message', 'chat.mention']);

type RichNotificationOptions = NotificationOptions & {
  requireInteraction?: boolean;
  vibrate?: number[];
  actions?: { action: string; title: string }[];
};

const isDocumentFocused = () => document.visibilityState === 'visible' && document.hasFocus();

// Cuộc gọi đến: khi app đang focus thì để chuông in-app (IncomingCallToastStack)
// lo; khi KHÔNG focus thì vẫn phải hiện thông báo OS (kể cả lúc bị mute, vì cuộc
// gọi luôn đổ chuông). Phòng trường hợp FCM đẩy vào foreground dù tab đang ẩn.
const showCallOsNotification = (data: PushNotificationData) => {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
  const isVideo = data.callKind === 'video';
  void navigator.serviceWorker.ready.then((registration) => {
    const options: RichNotificationOptions = {
      body: data.body || (isVideo ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'),
      icon: data.icon || '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      tag: data.tag || `call:${data.callId}`,
      requireInteraction: true,
      vibrate: [500, 300, 500, 300, 500],
      actions: [
        { action: 'answer', title: 'Trả lời' },
        { action: 'decline', title: 'Từ chối' },
      ],
      data: {
        type: 'call.incoming',
        conversationId: data.conversationId ?? null,
        callId: data.callId ?? null,
        callKind: data.callKind ?? null,
        declineToken: data.declineToken ?? null,
        link: data.link || '/',
      },
    };
    void registration.showNotification(data.title || 'Cuộc gọi đến', options);
  });
};


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
    silent: data.silent === '1',
  };
};

const isViewingConversation = (conversationId: number | null) => {
  if (!conversationId) return false;
  const chatStore = useChatStore();
  return isDocumentFocused() && chatStore.currentConversationId === conversationId;
};

const showOsNotification = (notification: AppNotification) => {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;

  void navigator.serviceWorker.ready.then((registration) => {
    void registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon || '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      tag: `${notification.type}:${notification.conversationId ?? notification.id}`,
      silent: notification.silent,
      data: {
        type: notification.type,
        conversationId: notification.conversationId ? String(notification.conversationId) : null,
        link: notification.link,
      },
    });
  });
};

const handleForegroundData = (data: PushNotificationData) => {
  // Cuộc gọi: focus -> chuông in-app; không focus -> thông báo OS có nút Trả lời/Từ chối.
  if (data.type === 'call.incoming') {
    if (!isDocumentFocused()) showCallOsNotification(data);
    return;
  }

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
