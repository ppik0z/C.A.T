<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AuthActionPage from "@/components/templates/AuthActionPage.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordRequest } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const token = ref(
  typeof route.query.token === "string" ? route.query.token : "",
);
const password = ref("");
const confirmPassword = ref("");
const isLoading = ref(false);
const isComplete = ref(false);
const error = ref<string | null>(null);

if (token.value) {
  void router.replace({ path: route.path });
}

const submit = async () => {
  error.value = null;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token.value)) {
    error.value = "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.";
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = "Mật khẩu xác nhận không khớp.";
    return;
  }

  isLoading.value = true;
  try {
    await resetPasswordRequest(token.value, password.value);
    authStore.clearSession();
    token.value = "";
    password.value = "";
    confirmPassword.value = "";
    isComplete.value = true;
  } catch (caught) {
    error.value =
      caught instanceof Error ? caught.message : "Không thể đặt lại mật khẩu.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <AuthActionPage
    description="Chọn mật khẩu mới có ít nhất 8 ký tự. Sau khi hoàn tất, mọi phiên đăng nhập cũ sẽ bị thu hồi."
    heading-id="reset-password-title"
    title="Đặt lại mật khẩu"
  >
    <div v-if="isComplete" class="space-y-5 text-center" aria-live="polite">
      <p
        class="rounded-lg bg-primary-container px-4 py-3 text-sm font-semibold text-on-primary-container"
      >
        Mật khẩu đã được thay đổi. Hãy đăng nhập lại bằng mật khẩu mới.
      </p>
      <RouterLink
        class="inline-flex font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        to="/login"
      >
        Đi tới đăng nhập
      </RouterLink>
    </div>

    <form
      v-else
      class="space-y-4"
      :aria-busy="isLoading"
      @submit.prevent="submit"
    >
      <div>
        <label
          class="mb-1 ml-1 block text-xs font-bold uppercase text-on-surface-variant"
          for="new-password"
          >Mật khẩu mới</label
        >
        <Input
          id="new-password"
          v-model="password"
          autocomplete="new-password"
          class="h-12 rounded-xl bg-surface-container-low px-4 text-base"
          :disabled="isLoading"
          maxlength="72"
          minlength="8"
          required
          type="password"
        />
      </div>
      <div>
        <label
          class="mb-1 ml-1 block text-xs font-bold uppercase text-on-surface-variant"
          for="confirm-new-password"
          >Xác nhận mật khẩu</label
        >
        <Input
          id="confirm-new-password"
          v-model="confirmPassword"
          autocomplete="new-password"
          class="h-12 rounded-xl bg-surface-container-low px-4 text-base"
          :disabled="isLoading"
          maxlength="72"
          minlength="8"
          required
          type="password"
        />
      </div>
      <p
        v-if="error"
        class="rounded-lg bg-error-container px-3 py-2 text-sm font-semibold text-error"
        role="alert"
      >
        {{ error }}
      </p>
      <Button
        class="h-12 w-full rounded-xl text-base"
        :disabled="isLoading"
        type="submit"
      >
        {{ isLoading ? "ĐANG CẬP NHẬT..." : "ĐỔI MẬT KHẨU" }}
      </Button>
    </form>
  </AuthActionPage>
</template>
