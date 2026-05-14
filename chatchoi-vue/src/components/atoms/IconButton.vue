<script setup lang="ts">
interface Props {
  icon: string;
  label: string;
  active?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
});
</script>

<template>
  <button
    :aria-label="props.label"
    :title="props.label"
    :class="[
      'w-10 h-10 flex items-center justify-center rounded-full transition-colors shrink-0',
      props.active
        ? 'bg-surface-container-high text-primary'
        : 'text-secondary hover:text-primary hover:bg-surface-container-high',
    ]"
    type="button"
  >
    <span class="material-symbols-outlined text-[22px]">{{ props.icon }}</span>
  </button>
</template>
