<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppBootstrapSkeleton from "./components/organisms/AppBootstrapSkeleton.vue";
import { useAuthStore } from "./stores/auth";

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const isLoggedIn = computed(() => authStore.status === "authenticated");
const isPublicAuthAction = computed(() => route.meta.publicAuthAction === true);

void authStore.bootstrap();

watch(
  [() => authStore.status, () => route.fullPath],
  async ([status]) => {
    if (status === "authenticated" && route.meta.guestOnly) {
      await router.replace("/");
    } else if (status === "guest" && route.meta.requiresAuth) {
      await router.replace("/login");
    }
  },
  { immediate: true },
);
</script>

<template>
  <RouterView v-if="isPublicAuthAction" />
  <AppBootstrapSkeleton
    v-else-if="
      authStore.status === 'unknown' || authStore.status === 'refreshing'
    "
  />
  <main
    v-else-if="authStore.status === 'unavailable'"
    class="flex min-h-screen items-center justify-center bg-background p-6 text-on-background"
  >
    <section
      class="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center shadow-lg"
      aria-labelledby="session-error-title"
    >
      <h1 id="session-error-title" class="mb-2 text-xl font-bold">
        Chưa thể kết nối
      </h1>
      <p class="mb-5 text-sm text-on-surface-variant">{{ authStore.error }}</p>
      <button
        class="h-11 rounded-xl bg-primary px-5 font-bold text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        type="button"
        @click="authStore.bootstrap()"
      >
        Thử lại
      </button>
    </section>
  </main>
  <RouterView
    v-else-if="
      (route.meta.requiresAuth && isLoggedIn) ||
      (route.meta.guestOnly && !isLoggedIn)
    "
  />
</template>
