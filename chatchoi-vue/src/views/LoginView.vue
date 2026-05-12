<script setup lang="ts">
import { ref } from 'vue';
import { useChatStore } from '../stores/chat';
import { initSocketService } from '../services/socket.service';
import { apiService } from '../services/api.service';

const chatStore = useChatStore();
const username = ref('');
const password = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  isLoading.value = true;
  try {
    const data = await apiService.login({ 
      username: username.value, 
      password: password.value 
    });

    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      
      chatStore.setIdentity(data.accessToken);
      initSocketService(data.accessToken);
      
      alert("Đăng nhập thành công!");
    }
  } catch (error: any) {
    alert(error.message || "Lỗi kết nối!");
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-bg-light dark:bg-bg-dark p-6 transition-colors duration-300">
    <div class="w-full max-w-md bg-white dark:bg-surface-dark p-8 rounded-2xl shadow-soft">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-primary mb-2">CHATCHOI</h1>
        <p class="text-slate-500 dark:text-slate-400 text-sm">Đăng nhập để bắt đầu kết nối</p>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Username</label>
          <input v-model="username" type="text" 
                 class="w-full px-4 py-3 rounded-xl bg-bg-light dark:bg-bg-dark border border-transparent focus:border-primary focus:outline-none transition-all dark:text-white"
                 placeholder="Tên đăng nhập của bồ...">
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Password</label>
          <input v-model="password" type="password" 
                 class="w-full px-4 py-3 rounded-xl bg-bg-light dark:bg-bg-dark border border-transparent focus:border-primary focus:outline-none transition-all dark:text-white"
                 placeholder="••••••••">
        </div>

        <button @click="handleLogin" :disabled="isLoading"
                class="w-full py-3 bg-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50">
          {{ isLoading ? 'ĐANG XỬ LÝ...' : 'ĐĂNG NHẬP' }}
        </button>
      </div>

      <p class="mt-6 text-center text-xs text-slate-400">
        Chưa có tài khoản? <span class="text-primary cursor-pointer hover:underline">Đăng ký ngay</span>
      </p>
    </div>
  </div>
</template>
