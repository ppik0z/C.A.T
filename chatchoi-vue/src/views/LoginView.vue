<script setup lang="ts">
import { computed, ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '../stores/auth';

type AuthMode = 'login' | 'register';

const authStore = useAuthStore();
const mode = ref<AuthMode>('login');
const username = ref('');
const email = ref('');
const displayName = ref('');
const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);
const localError = ref<string | null>(null);
const error = computed(() => localError.value ?? authStore.error);

const switchMode = (nextMode: AuthMode) => {
  if (isLoading.value) return;
  mode.value = nextMode;
  localError.value = null;
  password.value = '';
  confirmPassword.value = '';
};

const submit = async () => {
  localError.value = null;
  const normalizedUsername = username.value.trim().toLowerCase();
  if (!/^[a-z0-9._]{4,20}$/.test(normalizedUsername)) {
    localError.value = 'Username chỉ gồm chữ, số, dấu chấm hoặc gạch dưới và dài từ 4 đến 20 ký tự.';
    return;
  }
  if (mode.value === 'register' && password.value !== confirmPassword.value) {
    localError.value = 'Mật khẩu xác nhận không khớp.';
    return;
  }

  isLoading.value = true;
  try {
    if (mode.value === 'login') {
      await authStore.login({ username: normalizedUsername, password: password.value });
      return;
    }
    await authStore.register({
      username: normalizedUsername,
      email: email.value.trim().toLowerCase(),
      displayName: displayName.value.trim() || undefined,
      password: password.value,
    });
  } catch {
    // Store exposes the server-safe error message.
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-background p-6 text-on-background transition-colors duration-300">
    <section class="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-lg sm:p-8" aria-labelledby="auth-title">
      <div class="text-center mb-6">
        <h1 id="auth-title" class="text-3xl font-bold text-primary mb-2">CHATCHOI</h1>
        <p class="text-on-surface-variant text-sm">Kết nối và trò chuyện theo cách của bạn</p>
      </div>

      <div class="mb-6 grid grid-cols-2 rounded-lg bg-surface-container-low p-1" role="tablist" aria-label="Tài khoản">
        <button :aria-selected="mode === 'login'" :class="['rounded-md px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary', mode === 'login' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant']" :disabled="isLoading" role="tab" type="button" @click="switchMode('login')">
          Đăng nhập
        </button>
        <button :aria-selected="mode === 'register'" :class="['rounded-md px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-primary', mode === 'register' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant']" :disabled="isLoading" role="tab" type="button" @click="switchMode('register')">
          Đăng ký
        </button>
      </div>

      <form class="space-y-4" :aria-busy="isLoading" @submit.prevent="submit">
        <div>
          <label class="mb-1 ml-1 block text-xs font-bold uppercase text-on-surface-variant" for="username">Username</label>
          <Input id="username" v-model="username" autocapitalize="none" autocomplete="username" class="h-12 rounded-xl bg-surface-container-low px-4 text-base" :disabled="isLoading" maxlength="20" minlength="4" pattern="[a-zA-Z0-9._]+" required spellcheck="false" />
        </div>

        <div v-if="mode === 'register'">
          <label class="mb-1 ml-1 block text-xs font-bold uppercase text-on-surface-variant" for="display-name">Tên hiển thị</label>
          <Input id="display-name" v-model="displayName" autocomplete="name" class="h-12 rounded-xl bg-surface-container-low px-4 text-base" :disabled="isLoading" maxlength="64" placeholder="Không bắt buộc" />
        </div>

        <div v-if="mode === 'register'">
          <label class="mb-1 ml-1 block text-xs font-bold uppercase text-on-surface-variant" for="email">Email</label>
          <Input id="email" v-model="email" autocapitalize="none" autocomplete="email" class="h-12 rounded-xl bg-surface-container-low px-4 text-base" :disabled="isLoading" maxlength="255" required spellcheck="false" type="email" />
        </div>

        <div>
          <label class="mb-1 ml-1 block text-xs font-bold uppercase text-on-surface-variant" for="password">Mật khẩu</label>
          <Input id="password" v-model="password" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" class="h-12 rounded-xl bg-surface-container-low px-4 text-base" :disabled="isLoading" :minlength="mode === 'register' ? 8 : 1" maxlength="72" required type="password" />
        </div>

        <div v-if="mode === 'register'">
          <label class="mb-1 ml-1 block text-xs font-bold uppercase text-on-surface-variant" for="confirm-password">Xác nhận mật khẩu</label>
          <Input id="confirm-password" v-model="confirmPassword" autocomplete="new-password" class="h-12 rounded-xl bg-surface-container-low px-4 text-base" :disabled="isLoading" minlength="8" maxlength="72" required type="password" />
        </div>

        <p v-if="error" class="rounded-lg bg-error-container px-3 py-2 text-sm font-semibold text-error" role="alert" aria-live="assertive">{{ error }}</p>

        <Button class="h-12 w-full rounded-xl text-base" :disabled="isLoading" type="submit">
          {{ isLoading ? 'ĐANG XỬ LÝ...' : mode === 'login' ? 'ĐĂNG NHẬP' : 'TẠO TÀI KHOẢN' }}
        </Button>
      </form>
    </section>
  </main>
</template>
