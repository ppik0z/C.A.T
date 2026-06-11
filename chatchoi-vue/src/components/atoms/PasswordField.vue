<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff } from '@lucide/vue';

interface Props {
  id: string;
  label: string;
  autocomplete: 'current-password' | 'new-password';
  disabled?: boolean;
}

defineProps<Props>();
const model = defineModel<string>({ required: true });
const isVisible = ref(false);
</script>

<template>
  <div>
    <label :for="id" class="mb-1.5 block text-sm font-bold text-on-surface">
      {{ label }}
    </label>
    <div class="relative">
      <input
        :id="id"
        v-model="model"
        :autocomplete="autocomplete"
        class="h-11 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 pr-11 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="disabled"
        minlength="8"
        required
        :type="isVisible ? 'text' : 'password'"
      />
      <button
        class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-on-surface-variant transition hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
        :disabled="disabled"
        type="button"
        :aria-label="isVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
        @click="isVisible = !isVisible"
      >
        <EyeOff v-if="isVisible" class="h-4 w-4" aria-hidden="true" />
        <Eye v-else class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
