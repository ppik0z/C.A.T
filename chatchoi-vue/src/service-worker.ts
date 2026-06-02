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
      existingClient.postMessage({ type: 'OPEN_CONVERSATION', conversationId });
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

  void self.registration.showNotification(data.senderName || 'ChatChoi', {
    body: data.body || 'Bạn có tin nhắn mới.',
    icon: '/pwa/icon-192.png',
    badge: '/pwa/icon-192.png',
    tag: `conversation:${data.conversationId || 'unknown'}`,
    data: {
      conversationId: data.conversationId,
      link: data.link || '/',
    },
  });
});
