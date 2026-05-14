<script setup lang="ts">
import Avatar from '../atoms/Avatar.vue';
import IconButton from '../atoms/IconButton.vue';
import UserHoverCard from './UserHoverCard.vue';
import type { Conversation } from '../../types/chat';
import { getConversationName, getConversationUser } from '../../utils/chatPresentation';

interface Props {
  conversation: Conversation;
  detailsOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  back: [];
  toggleDetails: [];
}>();
</script>

<template>
  <header class="flex justify-between items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-outline-variant bg-surface-container-lowest sticky top-0 z-30">
    <div class="flex items-center gap-3 sm:gap-4 min-w-0">
      <IconButton class="lg:hidden" icon="arrow_back" label="Quay lại danh sách" @click="emit('back')" />

      <UserHoverCard :conversation="props.conversation" placement="bottom">
        <Avatar
          :avatar-url="getConversationUser(props.conversation)?.avatar"
          :is-online="props.conversation.isOnline"
          :name="getConversationName(props.conversation)"
          show-status
        />
      </UserHoverCard>

      <div class="min-w-0">
        <h2 class="text-lg sm:text-xl leading-7 font-bold text-primary truncate">{{ getConversationName(props.conversation) }}</h2>
        <p class="text-xs font-semibold text-secondary">{{ props.conversation.isOnline ? 'Active now' : 'Offline' }}</p>
      </div>
    </div>

    <div class="flex items-center gap-1 sm:gap-2">
      <IconButton class="hidden sm:flex" icon="call" label="Call" />
      <IconButton class="hidden sm:flex" icon="videocam" label="Video" />
      <div class="hidden sm:block w-px h-6 bg-outline-variant mx-1"></div>
      <IconButton :active="props.detailsOpen" icon="info" label="Conversation info" @click="emit('toggleDetails')" />
    </div>
  </header>
</template>
