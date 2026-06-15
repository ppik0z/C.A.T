<script setup lang="ts">
import Avatar from '../atoms/Avatar.vue';
import IconButton from '../atoms/IconButton.vue';
import UserHoverCard from './UserHoverCard.vue';
import type { Conversation } from '../../types/chat';
import { getConversationName, getConversationUser } from '../../utils/chatPresentation';
import { computed } from 'vue';

interface Props {
  conversation: Conversation;
  detailsOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  back: [];
  startCall: [kind: 'audio' | 'video'];
  toggleDetails: [];
}>();

const subtitle = computed(() => {
  if (props.conversation.isGroup) {
    return `${props.conversation.memberCount ?? 0} members`;
  }

  return props.conversation.isOnline ? 'Active now' : 'Offline';
});
</script>

<template>
  <header class="flex min-h-16 justify-between items-center gap-3 px-3 sm:px-5 py-2.5 border-b border-outline-variant/70 bg-surface-container-lowest/95 shadow-[0_1px_8px_rgba(15,23,42,0.04)] backdrop-blur-xl sticky top-0 z-30">
    <div class="flex items-center gap-3 sm:gap-4 min-w-0">
      <IconButton class="lg:hidden" icon="arrow_back" label="Quay lại danh sách" @click="emit('back')" />

      <UserHoverCard :conversation="props.conversation" placement="bottom">
        <Avatar
          :avatar-url="props.conversation.isGroup ? props.conversation.avatarGroup : getConversationUser(props.conversation)?.avatar"
          :is-online="!props.conversation.isGroup && props.conversation.isOnline"
          :name="getConversationName(props.conversation)"
          :show-status="!props.conversation.isGroup"
        />
      </UserHoverCard>

      <div class="min-w-0">
        <h2 class="text-base sm:text-lg leading-6 font-bold text-on-surface truncate">{{ getConversationName(props.conversation) }}</h2>
        <p class="text-xs font-medium text-on-surface-variant">{{ subtitle }}</p>
      </div>
    </div>

    <div class="flex items-center gap-1 sm:gap-2">
      <IconButton icon="call" label="Gọi thoại" @click="emit('startCall', 'audio')" />
      <IconButton icon="videocam" label="Gọi video" @click="emit('startCall', 'video')" />
      <div class="hidden sm:block w-px h-6 bg-outline-variant mx-1"></div>
      <IconButton :active="props.detailsOpen" icon="info" label="Conversation info" @click="emit('toggleDetails')" />
    </div>
  </header>
</template>
