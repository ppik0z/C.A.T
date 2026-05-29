import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { UserProfile, UserSettings, UpdateProfileRequest } from '../types/account';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useAccountStore = defineStore('account', () => {
  const profile = ref<UserProfile | null>(null);
  const settings = ref<UserSettings | null>(null);
  const isLoading = ref(false);

  const fetchAccount = async () => {
    isLoading.value = true;
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const res = await fetch(`${API_BASE}/account/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        profile.value = data.profile || {};
        settings.value = data.settings || {};
      }
    } catch (err) {
      console.error('Failed to fetch account', err);
    } finally {
      isLoading.value = false;
    }
  };

  const updateProfile = async (data: UpdateProfileRequest) => {
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`${API_BASE}/account/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const result = await res.json();
      profile.value = result.profile || {};
      return result;
    }
    throw new Error('Update failed');
  };

  const updateAvatar = async (file: File) => {
    const token = localStorage.getItem('accessToken');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/account/avatar`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (res.ok) {
      await fetchAccount(); // Refresh
      return true;
    }
    throw new Error('Avatar update failed');
  };

  return {
    profile,
    settings,
    isLoading,
    fetchAccount,
    updateProfile,
    updateAvatar,
  };
});
