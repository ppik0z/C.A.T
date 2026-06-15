import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  isFcmPushSupported,
  registerFcmSubscription,
  revokeFcmSubscription,
  shouldRegisterFcmSubscription,
} from '../services/push-notifications.service';
import { startForegroundNotifications, stopForegroundNotifications } from '../services/foreground-notifications';
import { useNotificationToastsStore } from './notification-toasts';

export type PushPermissionState = NotificationPermission | 'unsupported';

export const usePushNotificationsStore = defineStore('push-notifications', () => {
  const permission = ref<PushPermissionState>('default');
  const isEnabled = ref(false);
  const isLoading = ref(false);
  const isBannerDismissed = ref(false);
  const error = ref<string | null>(null);

  const shouldShowBanner = computed(() => {
    return permission.value === 'default' && !isEnabled.value && !isBannerDismissed.value;
  });

  const initializeAfterLogin = async () => {
    error.value = null;
    if (!await isFcmPushSupported()) {
      permission.value = 'unsupported';
      isEnabled.value = false;
      return;
    }

    // Lắng nghe foreground ngay cả khi quyền chưa "granted": message vẫn tới khi
    // đã có token, và việc đăng ký listener là idempotent.
    startForegroundNotifications();

    permission.value = Notification.permission;
    if (permission.value === 'granted' && shouldRegisterFcmSubscription()) {
      await registerSubscription();
    }
  };

  const enable = async () => {
    error.value = null;
    if (!await isFcmPushSupported()) {
      permission.value = 'unsupported';
      return;
    }

    const nextPermission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;

    permission.value = nextPermission;
    if (nextPermission !== 'granted') return;

    await registerSubscription();
  };

  const disable = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      await revokeFcmSubscription();
      isEnabled.value = false;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể tắt thông báo.';
      throw caught;
    } finally {
      isLoading.value = false;
    }
  };

  const dismissBanner = () => {
    isBannerDismissed.value = true;
  };

  const resetSession = () => {
    isEnabled.value = false;
    isBannerDismissed.value = false;
    error.value = null;
    stopForegroundNotifications();
    useNotificationToastsStore().clear();
  };

  const registerSubscription = async () => {
    isLoading.value = true;
    try {
      await registerFcmSubscription();
      isEnabled.value = true;
      permission.value = 'granted';
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể bật thông báo.';
      throw caught;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    permission,
    isEnabled,
    isLoading,
    shouldShowBanner,
    error,
    initializeAfterLogin,
    enable,
    disable,
    dismissBanner,
    resetSession,
  };
});
