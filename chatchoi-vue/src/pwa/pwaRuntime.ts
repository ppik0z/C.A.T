import { registerSW } from 'virtual:pwa-register';

let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
const PENDING_CONVERSATION_KEY = 'chatchoi.push.pending-conversation-id';
const OPEN_CONVERSATION_EVENT = 'push:open-conversation';

export const initializePwaRuntime = () => {
  navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
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

export const takePendingPushConversationId = () => {
  const value = localStorage.getItem(PENDING_CONVERSATION_KEY);
  localStorage.removeItem(PENDING_CONVERSATION_KEY);
  return value;
};

export const pushOpenConversationEvent = OPEN_CONVERSATION_EVENT;

const handleServiceWorkerMessage = (event: MessageEvent) => {
  if (event.data?.type !== 'OPEN_CONVERSATION' || typeof event.data.conversationId !== 'string') return;

  localStorage.setItem(PENDING_CONVERSATION_KEY, event.data.conversationId);
  window.dispatchEvent(new CustomEvent(OPEN_CONVERSATION_EVENT, {
    detail: { conversationId: event.data.conversationId },
  }));
};
