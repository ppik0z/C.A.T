import { defineStore } from 'pinia';
import { ref } from 'vue';
import {
  loginRequest,
  logoutAllRequest,
  logoutRequest,
  refreshSessionRequest,
  registerRequest,
  type AuthSessionResponse,
  type LoginInput,
  type RegisterInput,
} from '../services/auth.service';
import { isAuthenticationError } from '../services/apiClient';
import {
  configureSessionRuntime,
  getAccessToken,
  setAccessToken,
  withRefreshLock,
} from '../services/session.runtime';
import { clearSessionHint, hasSessionHint, setSessionHint } from '../services/auth-hint';
import { connectSocket, disconnectSocket } from '../services/socket.service';
import { useAccountStore } from './account';
import { useCallStore } from './call';
import { useCallMediaStore } from './call-media';
import { useChatStore } from './chat';
import { useFriendsStore } from './friends';
import { useProfilesStore } from './profiles';
import { usePushNotificationsStore } from './push-notifications';

export type AuthStatus = 'unknown' | 'refreshing' | 'authenticated' | 'guest' | 'unavailable';

let refreshPromise: Promise<string | null> | null = null;
let bootstrapPromise: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshAt = 0;
const REFRESH_EARLY_SECONDS = 60;
const MIN_REFRESH_DELAY_MS = 5_000;
const REFRESH_RETRY_DELAY_MS = 30_000;

export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('unknown');
  const error = ref<string | null>(null);

  const scheduleRefresh = (expiresInSeconds: number) => {
    if (refreshTimer) clearTimeout(refreshTimer);
    const delay = Math.max(
      MIN_REFRESH_DELAY_MS,
      (expiresInSeconds - REFRESH_EARLY_SECONDS) * 1_000,
    );
    refreshAt = Date.now() + delay;
    refreshTimer = setTimeout(() => {
      void refresh().catch(() => undefined);
    }, delay);
  };

  const hydrateSession = async () => {
    await Promise.allSettled([
      useAccountStore().fetchAccount(),
      useChatStore().loadConversations(),
      useFriendsStore().refreshAll(),
      useCallStore().loadActiveCalls(),
      usePushNotificationsStore().initializeAfterLogin(),
    ]);
  };

  const applySession = (session: AuthSessionResponse) => {
    setAccessToken(session.accessToken);
    useChatStore().setIdentity(session.accessToken);
    connectSocket(session.accessToken);
    scheduleRefresh(session.expiresInSeconds);
    setSessionHint();
    error.value = null;
    status.value = 'authenticated';
    void hydrateSession();
  };

  const refresh = async () => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = withRefreshLock(async () => {
      try {
        const session = await refreshSessionRequest();
        applySession(session);
        return session.accessToken;
      } catch (caught) {
        if (isAuthenticationError(caught)) {
          clearSession();
          return null;
        }
        if (status.value === 'authenticated') {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshAt = Date.now() + REFRESH_RETRY_DELAY_MS;
          refreshTimer = setTimeout(() => {
            void refresh().catch(() => undefined);
          }, REFRESH_RETRY_DELAY_MS);
        }
        throw caught;
      }
    })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };

  const bootstrap = async () => {
    if (bootstrapPromise) return bootstrapPromise;
    bootstrapPromise = (async () => {
      if (!hasSessionHint()) {
        status.value = 'guest';
        return;
      }
      status.value = 'refreshing';
      error.value = null;
      try {
        await refresh();
      } catch (caught) {
        status.value = 'unavailable';
        error.value = caught instanceof Error
          ? caught.message
          : 'Không thể khôi phục phiên đăng nhập.';
      }
    })().finally(() => {
      bootstrapPromise = null;
    });
    return bootstrapPromise;
  };

  const login = async (input: LoginInput) => {
    error.value = null;
    try {
      const session = await loginRequest(input);
      applySession(session);
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể đăng nhập.';
      throw caught;
    }
  };

  const register = async (input: RegisterInput) => {
    error.value = null;
    try {
      const session = await registerRequest(input);
      applySession(session);
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể đăng ký.';
      throw caught;
    }
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      clearSession();
    }
  };

  const logoutAll = async () => {
    try {
      await logoutAllRequest();
    } finally {
      clearSession();
    }
  };

  const clearSession = () => {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    refreshAt = 0;
    setAccessToken(null);
    disconnectSocket();
    const callMediaStore = useCallMediaStore();
    if (callMediaStore.activeCallId) {
      void callMediaStore.disconnectForCall(callMediaStore.activeCallId, false);
    } else {
      callMediaStore.resetMediaState();
    }
    useChatStore().resetSession();
    useAccountStore().clear();
    useProfilesStore().clear();
    useFriendsStore().$reset();
    useCallStore().resetSession();
    usePushNotificationsStore().resetSession();
    clearSessionHint();
    status.value = 'guest';
  };

  const refreshWhenVisible = () => {
    if (
      document.visibilityState === 'visible'
      && status.value === 'authenticated'
      && (!getAccessToken() || Date.now() >= refreshAt)
    ) {
      void refresh().catch(() => undefined);
    }
  };

  document.addEventListener('visibilitychange', refreshWhenVisible);

  configureSessionRuntime({ refresh, unauthorized: clearSession });

  return { status, error, bootstrap, login, register, refresh, logout, logoutAll, clearSession };
});
