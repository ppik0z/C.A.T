import { registerSW } from 'virtual:pwa-register';

let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
const PENDING_CONVERSATION_KEY = 'chatchoi.push.pending-conversation-id';
const OPEN_CONVERSATION_EVENT = 'push:open-conversation';
const NAVIGATE_EVENT = 'push:navigate';

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
export const pushNavigateEvent = NAVIGATE_EVENT;

/**
 * Điều hướng khi người dùng bấm vào một thông báo (từ service worker hoặc từ
 * toast foreground). Nếu có conversationId thì mở đúng đoạn chat; nếu không thì
 * phát sự kiện điều hướng chung kèm link để màn hình tự định tuyến.
 */
export const dispatchPushNavigation = (link: string, conversationId?: string | null) => {
  if (conversationId) {
    localStorage.setItem(PENDING_CONVERSATION_KEY, conversationId);
    window.dispatchEvent(new CustomEvent(OPEN_CONVERSATION_EVENT, {
      detail: { conversationId },
    }));
    return;
  }

  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: { link } }));
};

const handleServiceWorkerMessage = (event: MessageEvent) => {
  if (event.data?.type !== 'PUSH_NAVIGATE') return;

  const conversationId = typeof event.data.conversationId === 'string' ? event.data.conversationId : null;
  const link = typeof event.data.link === 'string' ? event.data.link : '/';
  dispatchPushNavigation(link, conversationId);
};
