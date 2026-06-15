import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AppNotification } from '../types/notification';

const TOAST_TTL_MS = 6_000;
const MAX_VISIBLE_TOASTS = 4;

export const useNotificationToastsStore = defineStore('notification-toasts', () => {
  const toasts = ref<AppNotification[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const dismiss = (id: string) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  };

  const push = (notification: AppNotification) => {
    // Gộp theo cùng đoạn chat: chỉ giữ toast mới nhất của một conversation.
    if (notification.conversationId) {
      const stale = toasts.value.find(
        (toast) => toast.conversationId === notification.conversationId,
      );
      if (stale) dismiss(stale.id);
    }

    toasts.value = [notification, ...toasts.value].slice(0, MAX_VISIBLE_TOASTS);
    timers.set(notification.id, setTimeout(() => dismiss(notification.id), TOAST_TTL_MS));
  };

  const clear = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
    toasts.value = [];
  };

  return { toasts, push, dismiss, clear };
});
