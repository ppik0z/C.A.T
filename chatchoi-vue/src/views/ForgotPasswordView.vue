<script setup lang="ts">
import { ref } from "vue";
import AuthActionPage from "@/components/templates/AuthActionPage.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { forgotPasswordRequest } from "@/services/auth.service";

const email = ref("");
const isLoading = ref(false);
const isSubmitted = ref(false);
const error = ref<string | null>(null);

const submit = async () => {
  error.value = null;
  isLoading.value = true;
  try {
    await forgotPasswordRequest(email.value.trim().toLowerCase());
    isSubmitted.value = true;
  } catch (caught) {
    error.value =
      caught instanceof Error ? caught.message : "Không thể gửi yêu cầu.";
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <AuthActionPage
    description="Nhập email đã xác minh của tài khoản. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu nếu tài khoản phù hợp."
    heading-id="forgot-password-title"
    title="Khôi phục mật khẩu"
  >
    <div v-if="isSubmitted" class="space-y-5 text-center" aria-live="polite">
      <p
        class="rounded-lg bg-primary-container px-4 py-3 text-sm font-semibold text-on-primary-container"
      >
        Nếu email tồn tại và đã được xác minh, hướng dẫn đặt lại mật khẩu đã
        được gửi.
      </p>
      <RouterLink
        class="inline-flex font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        to="/login"
      >
        Quay lại đăng nhập
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
          for="recovery-email"
          >Email</label
        >
        <Input
          id="recovery-email"
          v-model="email"
          autocapitalize="none"
          autocomplete="email"
          class="h-12 rounded-xl bg-surface-container-low px-4 text-base"
          :disabled="isLoading"
          maxlength="255"
          required
          spellcheck="false"
          type="email"
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
        {{ isLoading ? "ĐANG GỬI..." : "GỬI LIÊN KẾT" }}
      </Button>
      <RouterLink
        class="block text-center text-sm font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        to="/login"
      >
        Quay lại đăng nhập
      </RouterLink>
    </form>
  </AuthActionPage>
</template>
