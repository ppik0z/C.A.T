<script setup lang="ts">
interface Props {
  rows?: number;
}

const props = withDefaults(defineProps<Props>(), {
  rows: 6,
});
</script>

<template>
  <div class="animate-pulse" aria-hidden="true">
    <div
      v-for="row in props.rows"
      :key="row"
      class="flex items-center gap-4 border-b border-outline-variant/50 px-4 py-4 sm:px-6"
    >
      <div class="h-12 w-12 shrink-0 rounded-full bg-surface-container-high"></div>
      <div class="min-w-0 flex-1 space-y-2">
        <div
          class="h-3.5 rounded-full bg-surface-container-high"
          :class="row % 3 === 0 ? 'w-2/5' : 'w-3/5'"
        ></div>
        <div
          class="h-3 rounded-full bg-surface-container"
          :class="row % 2 === 0 ? 'w-4/5' : 'w-2/3'"
        ></div>
      </div>
    </div>
  </div>
</template>
