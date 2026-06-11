<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import AuthActionPage from "@/components/templates/AuthActionPage.vue";
import { verifyEmailRequest } from "@/services/auth.service";
import { useAccountStore } from "@/stores/account";
import { useAuthStore } from "@/stores/auth";

type VerificationStatus = "loading" | "success" | "error";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const accountStore = useAccountStore();
const token = typeof route.query.token === "string" ? route.query.token : "";
const status = ref<VerificationStatus>("loading");
const message = ref("Đang xác minh địa chỉ email...");

onMounted(async () => {
  if (token) await router.replace({ path: route.path });
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    status.value = "error";
    message.value = "Liên kết xác minh không hợp lệ hoặc đã hết hạn.";
    return;
  }

  try {
    const result = await verifyEmailRequest(token);
    status.value = "success";
    message.value = result.message;
    if (authStore.status === "authenticated") {
      await accountStore.fetchAccount().catch(() => undefined);
    }
  } catch (caught) {
    status.value = "error";
    message.value =
      caught instanceof Error ? caught.message : "Không thể xác minh email.";
  }
});
</script>

<template>
  <AuthActionPage
    description="Xác minh email giúp bảo vệ tài khoản và cho phép bạn khôi phục mật khẩu khi cần."
    heading-id="verify-email-title"
    title="Xác minh email"
  >
    <div class="space-y-5 text-center" aria-live="polite">
      <div
        v-if="status === 'loading'"
        class="mx-auto size-8 animate-spin rounded-full border-4 border-surface-container-high border-t-primary"
        aria-hidden="true"
      ></div>
      <p
        :class="[
          'rounded-lg px-4 py-3 text-sm font-semibold',
          status === 'error'
            ? 'bg-error-container text-error'
            : 'bg-primary-container text-on-primary-container',
        ]"
      >
        {{ message }}
      </p>
      <RouterLink
        class="inline-flex font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        :to="authStore.status === 'authenticated' ? '/' : '/login'"
      >
        {{
          authStore.status === "authenticated"
            ? "Về trang chính"
            : "Đi tới đăng nhập"
        }}
      </RouterLink>
    </div>
  </AuthActionPage>
</template>
