/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';
import { firebaseConfig } from './config/firebase';

declare let self: ServiceWorkerGlobalScope;

const precacheManifest = self.__WB_MANIFEST;
precacheAndRoute(precacheManifest);
cleanupOutdatedCaches();
clientsClaim();

if (precacheManifest.length > 0) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
}

const findAppClient = async () => {
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  return windowClients.find((client) => new URL(client.url).origin === self.location.origin) ?? null;
};

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data ?? {};
  const link = typeof data.link === 'string' ? data.link : '/';
  const conversationId = typeof data.conversationId === 'string' ? data.conversationId : null;
  const callId = typeof data.callId === 'string' ? data.callId : null;
  const isCall = data.type === 'call.incoming';

  event.waitUntil((async () => {
    const existingClient = await findAppClient();

    // Cuộc gọi đến: nút "Từ chối" báo client từ chối mà không cần mở app.
    if (isCall && event.action === 'decline') {
      if (existingClient) existingClient.postMessage({ type: 'CALL_DECLINE', callId });
      return;
    }

    // Bắt máy (hoặc bấm vào thân thông báo cuộc gọi) → mở app và tự trả lời.
    if (isCall) {
      if (existingClient) {
        existingClient.postMessage({ type: 'CALL_ANSWER', callId, conversationId });
        await existingClient.focus();
        return;
      }
      await self.clients.openWindow(link);
      return;
    }

    if (existingClient) {
      existingClient.postMessage({ type: 'PUSH_NAVIGATE', link, conversationId });
      await existingClient.focus();
      return;
    }

    await self.clients.openWindow(link);
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// `renotify`/`vibrate`/`actions` chưa đầy đủ trong type NotificationOptions của
// TS DOM lib nhưng được trình duyệt hỗ trợ → mở rộng kiểu để dùng.
type RichNotificationOptions = NotificationOptions & {
  renotify?: boolean;
  vibrate?: number[];
  actions?: { action: string; title: string }[];
};

const messaging = getMessaging(initializeApp(firebaseConfig));
onBackgroundMessage(messaging, (payload) => {
  const data = payload.data;
  if (!data) return;

  const tag = data.tag || `notif:${Date.now()}`;

  // Cuộc gọi kết thúc/huỷ/timeout → đóng thông báo cuộc gọi đến đang treo.
  if (data.type === 'call.cancel') {
    void self.registration.getNotifications({ tag }).then((notifications) => {
      notifications.forEach((notification) => notification.close());
    });
    return;
  }

  const commonData = {
    type: data.type || null,
    conversationId: data.conversationId || null,
    callId: data.callId || null,
    callKind: data.callKind || null,
    link: data.link || '/',
  };

  // Cuộc gọi đến: thiết kế riêng kiểu Messenger — đổ chuông liên tục, có nút
  // Trả lời / Từ chối, giữ thông báo cho tới khi người dùng thao tác.
  if (data.type === 'call.incoming') {
    const isVideo = data.callKind === 'video';
    const callOptions: RichNotificationOptions = {
      body: data.body || (isVideo ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến'),
      icon: data.icon || '/pwa/icon-192.png',
      badge: '/pwa/icon-192.png',
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [500, 300, 500, 300, 500],
      actions: [
        { action: 'answer', title: 'Trả lời' },
        { action: 'decline', title: 'Từ chối' },
      ],
      data: commonData,
    };
    void self.registration.showNotification(data.title || 'Cuộc gọi đến', callOptions);
    return;
  }

  const options: RichNotificationOptions = {
    body: data.body || 'Bạn có thông báo mới.',
    icon: data.icon || '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    tag,
    renotify: Boolean(data.tag),
    data: commonData,
  };
  void self.registration.showNotification(data.title || 'ChatChoi', options);
});
