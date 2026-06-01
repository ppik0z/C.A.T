import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { fetchAccountMe, patchAccountProfile, uploadAccountAvatar } from '../services/account.service';
import type { AccountMe, UpdateProfileRequest } from '../types/account';
import { useChatStore } from './chat';

export const useAccountStore = defineStore('account', () => {
  const me = ref<AccountMe | null>(null);
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);
  const settings = computed(() => me.value?.settings ?? null);

  const applyAccount = (account: AccountMe) => {
    me.value = account;
    useChatStore().applyCurrentUserProfile(account);
  };

  const fetchAccount = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const account = await fetchAccountMe();
      applyAccount(account);
      return account;
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Không thể tải thông tin tài khoản';
      throw caught;
    } finally {
      isLoading.value = false;
    }
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

  const clear = () => {
    me.value = null;
    error.value = null;
  };

  return {
    me,
    settings,
    isLoading,
    isSaving,
    error,
    fetchAccount,
    updateProfile,
    updateAvatar,
    clear,
  };
});
