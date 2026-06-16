import { registerSW } from 'virtual:pwa-register';

let applyServiceWorkerUpdate: ((reloadPage?: boolean) => Promise<void>) | null = null;
const PENDING_CONVERSATION_KEY = 'chatchoi.push.pending-conversation-id';
const OPEN_CONVERSATION_EVENT = 'push:open-conversation';
const NAVIGATE_EVENT = 'push:navigate';
const CALL_DECLINE_EVENT = 'push:call-decline';
const CALL_ANSWER_EVENT = 'push:call-answer';

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
export const pushCallDeclineEvent = CALL_DECLINE_EVENT;
export const pushCallAnswerEvent = CALL_ANSWER_EVENT;

const toCallId = (value: unknown) => {
  const callId = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isInteger(callId) && callId > 0 ? callId : null;
};

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
  const type = event.data?.type;

  if (type === 'CALL_DECLINE') {
    const callId = toCallId(event.data.callId);
    if (callId) {
      window.dispatchEvent(new CustomEvent(CALL_DECLINE_EVENT, { detail: { callId } }));
    }
    return;
  }

  if (type === 'CALL_ANSWER') {
    const callId = toCallId(event.data.callId);
    const conversationId = typeof event.data.conversationId === 'string' ? event.data.conversationId : null;
    window.dispatchEvent(new CustomEvent(CALL_ANSWER_EVENT, { detail: { callId, conversationId } }));
    return;
  }

  if (type === 'PUSH_NAVIGATE') {
    const conversationId = typeof event.data.conversationId === 'string' ? event.data.conversationId : null;
    const link = typeof event.data.link === 'string' ? event.data.link : '/';
    dispatchPushNavigation(link, conversationId);
  }
};
