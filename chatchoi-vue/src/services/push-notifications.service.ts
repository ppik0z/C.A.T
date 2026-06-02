import { getApp, getApps, initializeApp } from 'firebase/app';
import { deleteToken, getMessaging, getToken, isSupported, type Messaging } from 'firebase/messaging';
import { firebaseConfig, firebaseVapidKey } from '../config/firebase';
import { apiRequest } from './apiClient';

const INSTALLATION_ID_KEY = 'chatchoi.push.installation-id';
const PUSH_ENABLED_KEY = 'chatchoi.push.enabled';
const SERVICE_WORKER_READY_TIMEOUT_MS = 10_000;
const PUSH_SERVICE_RETRY_DELAY_MS = 1_500;

const getInstallationId = () => {
  const existing = localStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;

  const installationId = crypto.randomUUID();
  localStorage.setItem(INSTALLATION_ID_KEY, installationId);
  return installationId;
};

const getFirebaseMessaging = (): Messaging => {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return getMessaging(app);
};

const getReadyServiceWorker = async () => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Service worker chưa sẵn sàng. Hãy tải lại trang rồi thử bật thông báo lần nữa.'));
        }, SERVICE_WORKER_READY_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const isPushServiceRegistrationError = (caught: unknown) => {
  return caught instanceof Error
    && caught.message.toLowerCase().includes('registration failed - push service error');
};

const toPushRegistrationError = (caught: unknown) => {
  if (isPushServiceRegistrationError(caught)) {
    return new Error('Không thể kết nối dịch vụ push của trình duyệt. Hãy thử tắt VPN/proxy, đổi mạng hoặc dùng Chrome/Edge mới nhất.');
  }

  return caught instanceof Error ? caught : new Error('Không thể đăng ký nhận thông báo.');
};

const getFcmToken = async (registration: ServiceWorkerRegistration) => {
  return getToken(getFirebaseMessaging(), {
    serviceWorkerRegistration: registration,
    vapidKey: firebaseVapidKey,
  });
};

const getFcmTokenWithPushServiceRetry = async (registration: ServiceWorkerRegistration) => {
  try {
    return await getFcmToken(registration);
  } catch (caught) {
    if (!isPushServiceRegistrationError(caught)) throw toPushRegistrationError(caught);

    await new Promise((resolve) => setTimeout(resolve, PUSH_SERVICE_RETRY_DELAY_MS));

    try {
      return await getFcmToken(registration);
    } catch (retryError) {
      console.error('Không thể đăng ký FCM token sau khi retry.', retryError);
      throw toPushRegistrationError(retryError);
    }
  }
};

export const isFcmPushSupported = async () => {
  return 'serviceWorker' in navigator && 'Notification' in window && await isSupported();
};

export const shouldRegisterFcmSubscription = () => localStorage.getItem(PUSH_ENABLED_KEY) !== 'false';

export const registerFcmSubscription = async () => {
  const registration = await getReadyServiceWorker();
  const token = await getFcmTokenWithPushServiceRetry(registration);

  if (!token) {
    throw new Error('Trình duyệt không cấp được token thông báo.');
  }

  await apiRequest('/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      installationId: getInstallationId(),
      token,
    }),
  });

  localStorage.setItem(PUSH_ENABLED_KEY, 'true');
};

export const revokeFcmSubscription = async () => {
  const installationId = localStorage.getItem(INSTALLATION_ID_KEY);
  if (installationId) {
    await apiRequest(`/push/subscriptions/${installationId}`, { method: 'DELETE' });
  }

  await deleteToken(getFirebaseMessaging());
  localStorage.setItem(PUSH_ENABLED_KEY, 'false');
};
