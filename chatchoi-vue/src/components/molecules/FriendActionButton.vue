<script setup lang="ts">
import type { RelationshipStatus } from '../../types/friends';

interface Props {
  status?: RelationshipStatus;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  status: 'none',
  compact: false,
});

const emit = defineEmits<{
  add: [];
  cancel: [];
  accept: [];
  reject: [];
  message: [];
  remove: [];
}>();
</script>

<template>
  <div class="flex items-center gap-2">
    <template v-if="props.status === 'incoming_pending'">
      <button
        class="h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5"
        type="button"
        @click="emit('accept')"
      >
        <span class="material-symbols-outlined !text-[18px]">check</span>
        Accept
      </button>
      <button
        class="h-9 w-9 rounded-lg bg-surface-container-high text-on-surface-variant flex items-center justify-center"
        title="Reject"
        type="button"
        @click="emit('reject')"
      >
        <span class="material-symbols-outlined !text-[18px]">close</span>
      </button>
    </template>

    <button
      v-else-if="props.status === 'outgoing_pending'"
      class="h-9 px-3 rounded-lg bg-surface-container-high text-on-surface-variant text-xs font-bold flex items-center gap-1.5"
      type="button"
      @click="emit('cancel')"
    >
      <span class="material-symbols-outlined !text-[18px]">schedule</span>
      Cancel
    </button>

    <template v-else-if="props.status === 'friends'">
      <button
        class="h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5"
        type="button"
        @click="emit('message')"
      >
        <span class="material-symbols-outlined !text-[18px]">chat</span>
        Message
      </button>
      <button
        class="h-9 w-9 rounded-lg bg-error-container text-error flex items-center justify-center"
        title="Remove friend"
        type="button"
        @click="emit('remove')"
      >
        <span class="material-symbols-outlined !text-[18px]">person_remove</span>
      </button>
    </template>

    <button
      v-else
      class="h-9 px-3 rounded-lg bg-primary text-on-primary text-xs font-bold flex items-center gap-1.5"
      type="button"
      @click="emit('add')"
    >
      <span class="material-symbols-outlined !text-[18px]">person_add</span>
      Add
    </button>
  </div>
</template>
