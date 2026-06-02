<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { usePushNotificationsStore } from '@/stores/push-notifications';

const pushNotificationsStore = usePushNotificationsStore();

const enableNotifications = () => {
  void pushNotificationsStore.enable().catch(() => undefined);
};
</script>

<template>
  <aside
    v-if="pushNotificationsStore.shouldShowBanner"
    class="fixed bottom-20 left-4 right-4 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 shadow-lg md:bottom-4"
  >
    <span class="material-symbols-outlined mt-0.5 text-primary">notifications_active</span>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-extrabold text-on-surface">Bật thông báo tin nhắn</p>
      <p class="mt-1 text-xs font-semibold leading-5 text-on-surface-variant">
        Nhận thông báo khi ChatChoi đang chạy nền hoặc đã đóng.
      </p>
      <p v-if="pushNotificationsStore.error" class="mt-1 text-xs font-semibold text-error">
        {{ pushNotificationsStore.error }}
      </p>
      <div class="mt-3 flex gap-2">
        <Button :disabled="pushNotificationsStore.isLoading" size="sm" type="button" @click="enableNotifications">
          Bật thông báo
        </Button>
        <Button size="sm" type="button" variant="ghost" @click="pushNotificationsStore.dismissBanner">
          Để sau
        </Button>
      </div>
    </div>
  </aside>
</template>
