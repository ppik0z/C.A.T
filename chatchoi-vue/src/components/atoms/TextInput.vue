<script setup lang="ts">
interface Props {
  placeholder?: string;
  icon?: string;
}

const model = defineModel<string>({ required: true });
const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  icon: undefined,
});
</script>

<template>
  <label class="relative block">
    <span
      v-if="props.icon"
      class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]"
    >
      {{ props.icon }}
    </span>
    <input
      v-model="model"
      :class="[
        'w-full pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base',
        props.icon ? 'pl-11' : 'pl-4',
      ]"
      :placeholder="props.placeholder"
      type="text"
    />
  </label>
</template>
