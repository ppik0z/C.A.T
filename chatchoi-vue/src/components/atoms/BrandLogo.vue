<script setup lang="ts">
interface Props {
  alt?: string;
}

withDefaults(defineProps<Props>(), {
  alt: 'ChatChoi',
});
</script>

<template>
  <img
    :alt="alt"
    class="block shrink-0 object-contain"
    height="512"
    src="/pwa/cat-icon.svg"
    width="512"
  />
</template>
