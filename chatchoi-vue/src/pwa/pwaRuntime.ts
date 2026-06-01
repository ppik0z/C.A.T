import { registerSW } from 'virtual:pwa-register';

let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;

export const initializePwaRuntime = () => {
  applyServiceWorkerUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new CustomEvent('pwa:update-available'));
    },
    onOfflineReady() {
      window.dispatchEvent(new CustomEvent('pwa:offline-ready'));
    },
    onRegisterError(error) {
      console.error('Không thể đăng ký service worker.', error);
    },
  });
};

export const activatePwaUpdate = async () => {
  await applyServiceWorkerUpdate?.(true);
};
