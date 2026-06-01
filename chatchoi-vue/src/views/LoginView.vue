<script setup lang="ts">
import { ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChatStore } from '../stores/chat';
import { useFriendsStore } from '../stores/friends';
import { initSocketService } from '../services/socket.service';
import { apiBaseUrl } from '../config/api';
import { useAccountStore } from '../stores/account';

const chatStore = useChatStore();
const friendsStore = useFriendsStore();
const accountStore = useAccountStore();
const username = ref('');
const password = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  isLoading.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value })
    });

    const data = await response.json();

    if (data.accessToken) {
      // 1. Lưu cả hai token vào máy
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      
      // 2. Định danh và kết nối Socket
      chatStore.setIdentity(data.accessToken);
      initSocketService(data.accessToken);
      void friendsStore.refreshAll();
      void accountStore.fetchAccount();
      
      alert("Đăng nhập thành công!");
    } else {
      alert("Sai tài khoản hoặc mật khẩu!");
    }
  } catch (error) {
    console.error("Lỗi kết nối:", error);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-6 text-on-background transition-colors duration-300">
    <div class="w-full max-w-md rounded-lg border border-outline-variant bg-surface-container-lowest p-8 shadow-lg">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-primary mb-2">CHATCHOI</h1>
        <p class="text-on-surface-variant text-sm">Đăng nhập để bắt đầu kết nối</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1 ml-1">Username</label>
          <Input v-model="username" class="h-12 rounded-xl bg-surface-container-low px-4 text-base" placeholder="Tên đăng nhập của bồ..." />
        </div>

        <div>
          <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1 ml-1">Password</label>
          <Input v-model="password" class="h-12 rounded-xl bg-surface-container-low px-4 text-base" placeholder="••••••••" type="password" />
        </div>

        <Button class="h-12 w-full rounded-xl text-base" :disabled="isLoading" type="button" @click="handleLogin">
          {{ isLoading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP' }}
        </Button>
      </div>

      <p class="mt-6 text-center text-xs text-on-surface-variant">
        Chưa có tài khoản? <span class="text-primary cursor-pointer hover:underline">Đăng ký ngay</span>
      </p>
    </div>
  </div>
</template>
