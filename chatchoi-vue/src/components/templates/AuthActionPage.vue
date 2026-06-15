<script setup lang="ts">
import BrandLogo from '@/components/atoms/BrandLogo.vue';

defineProps<{
  headingId: string;
  title: string;
  description: string;
}>();
</script>

<template>
  <main
    class="flex min-h-screen items-center justify-center bg-background p-6 text-on-background"
  >
    <section
      class="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-lg sm:p-8"
      :aria-labelledby="headingId"
    >
      <div class="mb-6 text-center">
        <RouterLink
          class="mb-3 inline-flex flex-col items-center gap-2 rounded-xl text-2xl font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          to="/"
        >
          <BrandLogo alt="" class="size-14 rounded-2xl shadow-sm" />
          <span>CHATCHOI</span>
        </RouterLink>
        <h1 :id="headingId" class="text-xl font-bold text-on-surface">
          {{ title }}
        </h1>
        <p class="mt-2 text-sm leading-6 text-on-surface-variant">
          {{ description }}
        </p>
      </div>
      <slot />
    </section>
  </main>
</template>
