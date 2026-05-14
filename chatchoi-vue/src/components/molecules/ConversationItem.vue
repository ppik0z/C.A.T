<script setup lang="ts">
import Avatar from '../atoms/Avatar.vue';
import Badge from '../atoms/Badge.vue';
import UserHoverCard from './UserHoverCard.vue';
import type { Conversation } from '../../types/chat';
import {
  getConversationName,
  getConversationUser,
  getLastMessagePreview,
} from '../../utils/chatPresentation';

interface Props {
  conversation: Conversation;
  active: boolean;
  currentUsername: string | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [conversationId: number];
}>();
</script>

<template>
  <button
    :class="[
      'w-full px-4 sm:px-6 py-4 flex gap-4 text-left cursor-pointer transition-colors border-r-4',
      props.active ? 'bg-primary-container/35 border-primary' : 'border-transparent hover:bg-surface-container-high',
    ]"
    type="button"
    @click="emit('select', props.conversation.id)"
  >
    <UserHoverCard :conversation="props.conversation">
      <Avatar
        :avatar-url="getConversationUser(props.conversation)?.avatar"
        :is-online="props.conversation.isOnline"
        :name="getConversationName(props.conversation)"
        show-status
        size="lg"
      />
    </UserHoverCard>

    <div class="min-w-0 flex-1">
      <div class="flex justify-between items-baseline gap-3">
        <h3 class="font-semibold text-on-surface truncate">{{ getConversationName(props.conversation) }}</h3>
        <Badge v-if="props.conversation.unreadCount > 0" tone="primary">{{ props.conversation.unreadCount }}</Badge>
      </div>
      <p
        :class="[
          'text-sm truncate mt-1',
          props.conversation.unreadCount > 0 ? 'text-primary font-semibold' : 'text-on-surface-variant',
        ]"
      >
        {{ getLastMessagePreview(props.conversation, props.currentUsername) }}
      </p>
    </div>
  </button>
</template>
