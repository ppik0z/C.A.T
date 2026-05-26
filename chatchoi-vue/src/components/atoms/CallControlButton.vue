<script setup lang="ts">
interface Props {
  icon: string;
  label: string;
  active?: boolean;
  tone?: 'neutral' | 'primary' | 'danger';
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  tone: 'neutral',
});
</script>

<template>
  <button
    :aria-label="props.label"
    :title="props.label"
    :class="[
      'h-12 w-12 rounded-full flex items-center justify-center transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
      props.tone === 'danger'
        ? 'bg-error text-white hover:bg-error/90'
        : props.tone === 'primary'
          ? 'bg-primary text-on-primary hover:bg-primary/90'
          : props.active
            ? 'bg-primary-container text-primary'
            : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
    ]"
    type="button"
  >
    <span class="material-symbols-outlined text-[24px]">{{ props.icon }}</span>
  </button>
</template>
