<script setup lang="ts">
import { computed } from 'vue';
import { CheckCheck, Loader2, X } from '@lucide/vue';
import Avatar from '../atoms/Avatar.vue';
import { useNotificationsStore } from '../../stores/notifications';
import { dispatchPushNavigation } from '../../pwa/pwaRuntime';
import {
  dateGroupLabel,
  dateGroupOf,
  formatRelativeTime,
  iconForNotification,
} from '../../utils/notificationPresentation';
import type { NotificationItem } from '../../types/notification';

const store = useNotificationsStore();

const groups = computed(() => {
  const today: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];
  for (const item of store.items) {
    (dateGroupOf(item.createdAt) === 'today' ? today : earlier).push(item);
  }
  const result: Array<{ key: string; label: string; items: NotificationItem[] }> = [];
  if (today.length) result.push({ key: 'today', label: dateGroupLabel.today, items: today });
  if (earlier.length) result.push({ key: 'earlier', label: dateGroupLabel.earlier, items: earlier });
  return result;
});

const handleOpen = (item: NotificationItem) => {
  void store.markRead(item.id);
  dispatchPushNavigation(item.link || '/', item.conversationId ? String(item.conversationId) : null);
  store.close();
};

const onScroll = (event: Event) => {
  const el = event.target as HTMLElement;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) void store.loadMore();
};
</script>

<template>
  <Teleport to="body">
    <Transition name="notif-fade">
      <div v-if="store.isOpen" class="fixed inset-0 z-[120]">
        <!-- Backdrop: bắt click ra ngoài để đóng (mờ trên mobile, trong suốt trên desktop). -->
        <div class="absolute inset-0 bg-black/40 md:bg-transparent" @click="store.close()" />

        <section
          class="absolute inset-x-0 bottom-0 top-0 flex flex-col bg-surface-container-lowest shadow-2xl md:inset-auto md:left-[5.5rem] md:top-4 md:h-[min(40rem,calc(100vh-2rem))] md:w-[26rem] md:rounded-3xl md:border md:border-outline-variant/70"
          role="dialog"
          aria-label="Trung tâm thông báo"
        >
          <header class="flex items-center justify-between gap-2 px-4 py-3 border-b border-outline-variant/60 md:px-5">
            <h2 class="text-lg font-bold text-on-surface">Thông báo</h2>
            <div class="flex items-center gap-1">
              <button
                v-if="store.unreadCount > 0"
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-container/50"
                @click="store.markAllRead()"
              >
                <CheckCheck class="h-4 w-4" aria-hidden="true" />
                <span>Đánh dấu đã đọc</span>
              </button>
              <button
                type="button"
                class="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                aria-label="Đóng"
                @click="store.close()"
              >
                <X class="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </header>

          <div class="flex-1 overflow-y-auto overscroll-contain" @scroll="onScroll">
            <!-- Đang tải lần đầu -->
            <div v-if="store.isLoading && store.items.length === 0" class="flex h-40 items-center justify-center text-on-surface-variant">
              <Loader2 class="h-6 w-6 animate-spin" aria-hidden="true" />
            </div>

            <!-- Trống -->
            <div
              v-else-if="store.items.length === 0"
              class="flex h-full min-h-40 flex-col items-center justify-center gap-2 px-6 text-center text-on-surface-variant"
            >
              <component :is="iconForNotification('default')" class="h-10 w-10 opacity-40" aria-hidden="true" />
              <p class="text-sm font-medium">Chưa có thông báo nào</p>
            </div>

            <!-- Danh sách theo nhóm -->
            <template v-else>
              <section v-for="group in groups" :key="group.key">
                <p class="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant md:px-5">
                  {{ group.label }}
                </p>
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  type="button"
                  class="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-container-low md:px-5"
                  :class="item.readAt ? '' : 'bg-primary-container/20'"
                  @click="handleOpen(item)"
                >
                  <div class="relative shrink-0">
                    <Avatar v-if="item.actor?.avatar" :avatar-url="item.actor.avatar" :name="item.actor.displayName || item.title" size="md" />
                    <span
                      v-else
                      class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
                    >
                      <component :is="iconForNotification(item.type)" class="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span
                      class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-on-primary"
                    >
                      <component :is="iconForNotification(item.type)" class="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>

                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold text-on-surface">{{ item.title }}</p>
                    <p class="line-clamp-2 text-sm text-on-surface-variant">{{ item.body }}</p>
                    <p class="mt-0.5 text-xs text-on-surface-variant/80">{{ formatRelativeTime(item.createdAt) }}</p>
                  </div>

                  <span v-if="!item.readAt" class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Chưa đọc" />
                </button>
              </section>

              <div v-if="store.isLoadingMore" class="flex items-center justify-center py-4 text-on-surface-variant">
                <Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
              </div>
            </template>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.notif-fade-enter-active,
.notif-fade-leave-active {
  transition: opacity 0.18s ease;
}
.notif-fade-enter-from,
.notif-fade-leave-to {
  opacity: 0;
}
</style>
