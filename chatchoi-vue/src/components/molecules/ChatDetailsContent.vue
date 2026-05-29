<script setup lang="ts">
import DirectChatDetailsContent from './DirectChatDetailsContent.vue';
import GroupChatDetailsContent from './GroupChatDetailsContent.vue';
import type { Conversation } from '../../types/chat';

interface Props {
  conversation: Conversation | null;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
});

const emit = defineEmits<{
  openMessageSearch: [];
}>();
</script>

<template>
  <GroupChatDetailsContent
    v-if="props.conversation?.isGroup"
    :compact="props.compact"
    :conversation="props.conversation"
    @open-message-search="emit('openMessageSearch')"
  />
  <DirectChatDetailsContent
    v-else
    :compact="props.compact"
    :conversation="props.conversation"
    @open-message-search="emit('openMessageSearch')"
  />
</template>
