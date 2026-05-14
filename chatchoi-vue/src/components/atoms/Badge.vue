<script setup lang="ts">
interface Props {
  tone?: 'primary' | 'neutral';
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'neutral',
});
</script>

<template>
  <span
    :class="[
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
      props.tone === 'primary'
        ? 'bg-primary text-on-primary'
        : 'bg-surface-container-high text-on-surface-variant',
    ]"
  >
    <slot />
  </span>
</template>
