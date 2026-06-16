import { defineStore } from 'pinia';
import {
  deleteNotification,
  fetchNotifications,
  markNotificationsRead,
} from '../services/notification.service';
import type { NotificationItem } from '../types/notification';

const PAGE_SIZE = 20;

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items: [] as NotificationItem[],
    unreadCount: 0,
    isOpen: false,
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    loaded: false,
  }),

  actions: {
    async load() {
      if (this.isLoading) return;
      this.isLoading = true;
      try {
        const result = await fetchNotifications({ limit: PAGE_SIZE });
        this.items = result.items;
        this.unreadCount = result.unreadCount;
        this.hasMore = result.hasMore;
        this.loaded = true;
      } catch {
        // Lỗi mạng: giữ trạng thái cũ, người dùng có thể thử mở lại.
      } finally {
        this.isLoading = false;
      }
    },

    async loadMore() {
      if (this.isLoadingMore || !this.hasMore || this.items.length === 0) return;
      this.isLoadingMore = true;
      try {
        const beforeId = this.items[this.items.length - 1].id;
        const result = await fetchNotifications({ limit: PAGE_SIZE, beforeId });
        const existing = new Set(this.items.map((item) => item.id));
        this.items.push(...result.items.filter((item) => !existing.has(item.id)));
        this.unreadCount = result.unreadCount;
        this.hasMore = result.hasMore;
      } catch {
        // Bỏ qua: nút "tải thêm" vẫn dùng lại được.
      } finally {
        this.isLoadingMore = false;
      }
    },

    /** Nhận thông báo mới realtime qua socket. */
    prepend(notification: NotificationItem) {
      if (this.items.some((item) => item.id === notification.id)) return;
      this.items.unshift(notification);
      if (!notification.readAt) this.unreadCount += 1;
    },

    async markRead(id: number) {
      const item = this.items.find((entry) => entry.id === id);
      if (!item || item.readAt) return;
      item.readAt = new Date().toISOString();
      this.unreadCount = Math.max(this.unreadCount - 1, 0);
      try {
        const result = await markNotificationsRead({ ids: [id] });
        this.unreadCount = result.unreadCount;
      } catch {
        // Giữ trạng thái lạc quan; sẽ đồng bộ lại ở lần load sau.
      }
    },

    async markAllRead() {
      if (this.unreadCount === 0) return;
      const now = new Date().toISOString();
      this.items.forEach((item) => {
        if (!item.readAt) item.readAt = now;
      });
      this.unreadCount = 0;
      try {
        await markNotificationsRead({ all: true });
      } catch {
        // Bỏ qua: trạng thái sẽ đồng bộ lại ở lần load sau.
      }
    },

    async remove(id: number) {
      const index = this.items.findIndex((item) => item.id === id);
      if (index === -1) return;
      const [removed] = this.items.splice(index, 1);
      if (removed && !removed.readAt) this.unreadCount = Math.max(this.unreadCount - 1, 0);
      try {
        const result = await deleteNotification(id);
        this.unreadCount = result.unreadCount;
      } catch {
        // Bỏ qua.
      }
    },

    open() {
      this.isOpen = true;
      if (!this.loaded) void this.load();
    },

    close() {
      this.isOpen = false;
    },

    toggle() {
      if (this.isOpen) this.close();
      else this.open();
    },

    reset() {
      this.$reset();
    },
  },
});
