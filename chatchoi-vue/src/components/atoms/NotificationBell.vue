<script setup lang="ts">
import { computed } from 'vue';
import { Bell } from '@lucide/vue';
import { useNotificationsStore } from '../../stores/notifications';

const store = useNotificationsStore();
const unreadCount = computed(() => store.unreadCount);
const badge = computed(() => (unreadCount.value > 99 ? '99+' : String(unreadCount.value)));
</script>

<template>
  <button
    type="button"
    class="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    :class="store.isOpen ? 'bg-primary-container text-primary' : ''"
    :aria-label="unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : 'Thông báo'"
    @click="store.toggle()"
  >
    <Bell class="h-5 w-5" aria-hidden="true" />
    <span
      v-if="unreadCount > 0"
      class="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-error text-on-error text-[0.625rem] leading-4 text-center font-bold font-body"
    >
      {{ badge }}
    </span>
  </button>
</template>
