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
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="props.isOpen" class="fixed inset-0 z-[90] xl:hidden">
      <button class="absolute inset-0 bg-black/30" type="button" aria-label="Close details" @click="emit('close')" />
      <aside class="absolute right-0 top-0 h-full w-[min(92vw,340px)] bg-surface-container-lowest border-l border-outline-variant shadow-2xl overflow-y-auto thin-scrollbar">
        <div class="flex justify-end p-3">
          <IconButton icon="close" label="Close details" @click="emit('close')" />
        </div>
        <ChatDetailsContent :conversation="props.conversation" />
      </aside>
    </div>
  </Teleport>

  <aside
    :class="[
      'hidden xl:flex h-full bg-surface-container-lowest border-l border-outline-variant flex-col overflow-hidden shrink-0 z-40 transition-all duration-300',
      props.isOpen ? 'w-[clamp(280px,24vw,340px)] opacity-100' : 'w-0 opacity-0 border-l-0',
    ]"
  >
    <div class="w-[clamp(280px,24vw,340px)]">
      <ChatDetailsContent :conversation="props.conversation" compact />
    </div>
  </aside>
</template>
