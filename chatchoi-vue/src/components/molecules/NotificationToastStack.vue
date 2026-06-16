<script setup lang="ts">
import { computed } from 'vue';
import { X } from '@lucide/vue';
import Avatar from '../atoms/Avatar.vue';
import { useNotificationToastsStore } from '../../stores/notification-toasts';
import { openNotification } from '../../services/foreground-notifications';
import { iconForNotification } from '../../utils/notificationPresentation';
import type { AppNotification } from '../../types/notification';

const toastsStore = useNotificationToastsStore();
const toasts = computed(() => toastsStore.toasts);

const iconFor = iconForNotification;

const handleOpen = (toast: AppNotification) => {
  openNotification(toast);
  toastsStore.dismiss(toast.id);
};
</script>

<template>
  <div class="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[130] flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-[22rem]">
    <button
      v-for="toast in toasts"
      :key="toast.id"
      type="button"
      class="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-outline-variant/70 bg-surface-container-lowest/95 p-3 text-left shadow-2xl shadow-black/20 backdrop-blur-xl transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      @click="handleOpen(toast)"
    >
      <div class="relative shrink-0">
        <Avatar v-if="toast.icon" :avatar-url="toast.icon" :name="toast.title" size="md" />
        <span
          v-else
          class="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container"
        >
          <component :is="iconFor(toast.type)" class="h-5 w-5" aria-hidden="true" />
        </span>
        <span
          class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface-container-lowest bg-primary text-on-primary"
        >
          <component :is="iconFor(toast.type)" class="h-3 w-3" aria-hidden="true" />
        </span>
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-bold text-on-surface">{{ toast.title }}</p>
        <p class="truncate text-xs text-on-surface-variant">{{ toast.body }}</p>
      </div>

      <span
        class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
        role="button"
        aria-label="Đóng thông báo"
        @click.stop="toastsStore.dismiss(toast.id)"
      >
        <X class="h-4 w-4" aria-hidden="true" />
      </span>
    </button>
  </div>
</template>
