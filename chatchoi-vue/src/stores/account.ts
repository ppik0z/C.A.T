import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import {
  fetchAccountMe,
  patchAccountProfile,
  patchAccountSettings,
  updateAccountPassword,
  uploadAccountAvatar,
} from '../services/account.service';
import type {
  AccountMe,
  UpdatePasswordRequest,
  UpdateProfileRequest,
  UpdateSettingsRequest,
} from '../types/account';
import { useChatStore } from './chat';

export const useAccountStore = defineStore('account', () => {
  const me = ref<AccountMe | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const isChangingPassword = ref(false);
  const error = ref<string | null>(null);
  const settings = computed(() => me.value?.settings ?? null);
  let fetchPromise: Promise<AccountMe> | null = null;
  let sessionGeneration = 0;

  const applyAccount = (account: AccountMe) => {
    me.value = account;
    useChatStore().applyCurrentUserProfile(account);
  };

  const fetchAccount = async () => {
    if (fetchPromise) return fetchPromise;
    const requestGeneration = sessionGeneration;
    isLoading.value = true;
    error.value = null;
    fetchPromise = fetchAccountMe()
      .then((account) => {
        if (requestGeneration === sessionGeneration) {
          applyAccount(account);
        }
        return account;
      })
      .catch((caught: unknown) => {
        if (requestGeneration === sessionGeneration) {
          error.value = caught instanceof Error ? caught.message : 'Không thể tải thông tin tài khoản';
        }
        throw caught;
      })
      .finally(() => {
        if (requestGeneration === sessionGeneration) {
          isLoading.value = false;
          fetchPromise = null;
        }
      });
    return fetchPromise;
  };

  const updateProfile = async (input: UpdateProfileRequest) => {
    isSaving.value = true;
    error.value = null;
    try {
      const account = await patchAccountProfile(input);
      applyAccount(account);
      return account;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể cập nhật hồ sơ';
      throw caught;
    } finally {
      isSaving.value = false;
    }
  };

  const updateAvatar = async (file: File) => {
    isSaving.value = true;
    error.value = null;
    try {
      const account = await uploadAccountAvatar(file);
      applyAccount(account);
      return account;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể cập nhật ảnh đại diện';
      throw caught;
    } finally {
      isSaving.value = false;
    }
  };

  const updateSettings = async (input: UpdateSettingsRequest) => {
    isSaving.value = true;
    error.value = null;
    try {
      const account = await patchAccountSettings(input);
      applyAccount(account);
      return account;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể cập nhật cài đặt';
      throw caught;
    } finally {
      isSaving.value = false;
    }
  };

  const changePassword = async (input: UpdatePasswordRequest) => {
    isChangingPassword.value = true;
    error.value = null;
    try {
      return await updateAccountPassword(input);
    } finally {
      isChangingPassword.value = false;
    }
  };

  const clear = () => {
    sessionGeneration += 1;
    fetchPromise = null;
    me.value = null;
    isLoading.value = false;
    error.value = null;
  };

  return {
    me,
    settings,
    isLoading,
    isSaving,
    isChangingPassword,
    error,
    fetchAccount,
    updateProfile,
    updateAvatar,
    updateSettings,
    changePassword,
    clear,
  };
});
