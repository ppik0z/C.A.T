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
  <main v-if="authStore.status === 'unknown' || authStore.status === 'refreshing'" class="flex min-h-screen items-center justify-center bg-background p-6 text-on-background" aria-live="polite">
    <div class="text-center">
      <div class="mx-auto mb-4 size-8 animate-spin rounded-full border-4 border-surface-container-high border-t-primary" aria-hidden="true"></div>
      <p class="text-sm font-semibold text-on-surface-variant">Đang khôi phục phiên đăng nhập...</p>
    </div>
  </main>
  <main v-else-if="authStore.status === 'unavailable'" class="flex min-h-screen items-center justify-center bg-background p-6 text-on-background">
    <section class="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center shadow-lg" aria-labelledby="session-error-title">
      <h1 id="session-error-title" class="mb-2 text-xl font-bold">Chưa thể kết nối</h1>
      <p class="mb-5 text-sm text-on-surface-variant">{{ authStore.error }}</p>
      <button class="h-11 rounded-xl bg-primary px-5 font-bold text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" type="button" @click="authStore.bootstrap()">
        Thử lại
      </button>
    </section>
  </main>
  <LoginView v-else-if="!isLoggedIn" />
  <MessageDashboard v-else />
</template>
