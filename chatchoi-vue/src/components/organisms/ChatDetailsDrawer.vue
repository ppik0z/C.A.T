<script setup lang="ts">
import IconButton from '../atoms/IconButton.vue';
import ChatDetailsContent from '../molecules/ChatDetailsContent.vue';
import type { Conversation } from '../../types/chat';

interface Props {
  conversation: Conversation | null;
  isOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  openMessageSearch: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="details-overlay">
      <div v-if="props.isOpen" class="fixed inset-0 z-[90]">
        <button class="absolute inset-0 bg-black/30" type="button" aria-label="Close details" @click="emit('close')" />
      </div>
    </Transition>

    <Transition name="details-panel">
      <aside v-if="props.isOpen" class="fixed right-0 top-0 z-[91] flex h-full w-[min(92vw,380px)] flex-col bg-surface-container-lowest border-l border-outline-variant shadow-2xl">
        <div class="flex justify-end p-3 shrink-0">
          <IconButton icon="close" label="Close details" @click="emit('close')" />
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto thin-scrollbar">
          <ChatDetailsContent
            :conversation="props.conversation"
            @open-message-search="emit('openMessageSearch')"
          />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.details-overlay-enter-active,
.details-overlay-leave-active {
  transition: opacity 160ms ease;
}

.details-overlay-enter-from,
.details-overlay-leave-to {
  opacity: 0;
}

.details-panel-enter-active,
.details-panel-leave-active {
  transition:
    transform 190ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 160ms ease;
}

.details-panel-enter-from,
.details-panel-leave-to {
  opacity: 0;
  transform: translateX(24px);
}
</style>
