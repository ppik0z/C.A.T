<script setup lang="ts">
interface Props {
  icon: string;
  title: string;
  description: string;
}

const props = defineProps<Props>();
</script>

<template>
  <div class="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <div class="flex min-w-0 gap-3">
      <div class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
        <span class="material-symbols-outlined !text-[20px]">{{ props.icon }}</span>
      </div>
      <div class="min-w-0">
        <h4 class="text-sm font-bold leading-5 text-on-surface">{{ props.title }}</h4>
        <p class="mt-1 text-sm font-medium leading-5 text-on-surface-variant">{{ props.description }}</p>
      </div>
    </div>
    <div class="flex items-center gap-2 sm:justify-end">
      <slot />
    </div>
  </div>
</template>
