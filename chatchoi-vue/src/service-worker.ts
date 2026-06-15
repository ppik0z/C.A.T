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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = typeof event.notification.data?.link === 'string'
    ? event.notification.data.link
    : '/';
  const conversationId = typeof event.notification.data?.conversationId === 'string'
    ? event.notification.data.conversationId
    : null;

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existingClient = windowClients.find((client) => new URL(client.url).origin === self.location.origin);

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

const messaging = getMessaging(initializeApp(firebaseConfig));
onBackgroundMessage(messaging, (payload) => {
  const data = payload.data;
  if (!data) return;

  const tag = data.tag || `notif:${Date.now()}`;
  // `renotify` chưa có trong type NotificationOptions của TS DOM lib nhưng được
  // trình duyệt hỗ trợ; cast để bật cảnh báo lại khi gộp theo tag.
  const options: NotificationOptions & { renotify?: boolean } = {
    body: data.body || 'Bạn có thông báo mới.',
    icon: data.icon || '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    tag,
    renotify: Boolean(data.tag),
    data: {
      type: data.type || null,
      conversationId: data.conversationId || null,
      link: data.link || '/',
    },
  };
  void self.registration.showNotification(data.title || 'ChatChoi', options);
});
