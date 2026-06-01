<script setup lang="ts">
import { computed, onMounted } from 'vue';
import LoginView from './views/LoginView.vue';
import MessageDashboard from './pages/MessageDashboard.vue';
import { useAuthStore } from './stores/auth';

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.status === 'authenticated');

onMounted(() => {
  void authStore.bootstrap();
});
</script>

<template>
  <div v-if="authStore.status === 'unknown' || authStore.status === 'refreshing'" class="flex min-h-screen items-center justify-center bg-background text-on-background">
    <p class="text-sm font-semibold text-on-surface-variant">Đang khôi phục phiên đăng nhập...</p>
  </div>
  <LoginView v-else-if="!isLoggedIn" />
  <MessageDashboard v-else />
</template>
