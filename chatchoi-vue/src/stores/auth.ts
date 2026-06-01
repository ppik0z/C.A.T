import { defineStore } from 'pinia';
import { ref } from 'vue';
import { loginRequest, logoutAllRequest, logoutRequest, refreshSessionRequest, registerRequest, type LoginInput, type RegisterInput } from '../services/auth.service';
import { configureSessionRuntime, setAccessToken } from '../services/session.runtime';
import { connectSocket, disconnectSocket } from '../services/socket.service';
import { useAccountStore } from './account';
import { useCallStore } from './call';
import { useCallMediaStore } from './call-media';
import { useChatStore } from './chat';
import { useFriendsStore } from './friends';
import { useProfilesStore } from './profiles';

export type AuthStatus = 'unknown' | 'refreshing' | 'authenticated' | 'guest';

let refreshPromise: Promise<string | null> | null = null;

export const useAuthStore = defineStore('auth', () => {
  const status = ref<AuthStatus>('unknown');
  const error = ref<string | null>(null);

  const applySession = async (accessToken: string) => {
    setAccessToken(accessToken);
    useChatStore().setIdentity(accessToken);
    connectSocket(accessToken);
    status.value = 'authenticated';
    await Promise.allSettled([
      useAccountStore().fetchAccount(),
      useFriendsStore().refreshAll(),
      useCallStore().loadActiveCalls(),
    ]);
  };

  const refresh = async () => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = refreshSessionRequest()
      .then(async ({ accessToken }) => {
        await applySession(accessToken);
        return accessToken;
      })
      .catch(() => {
        clearSession();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };

  const bootstrap = async () => {
    status.value = 'refreshing';
    await refresh();
  };

  const login = async (input: LoginInput) => {
    error.value = null;
    try {
      const session = await loginRequest(input);
      await applySession(session.accessToken);
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể đăng nhập.';
      throw caught;
    }
  };

  const register = async (input: RegisterInput) => {
    error.value = null;
    try {
      const session = await registerRequest(input);
      await applySession(session.accessToken);
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
    status.value = 'guest';
  };

  configureSessionRuntime({ refresh, unauthorized: clearSession });

  return { status, error, bootstrap, login, register, refresh, logout, logoutAll, clearSession };
});
