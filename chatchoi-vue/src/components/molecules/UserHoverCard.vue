<script setup lang="ts">
import { computed } from 'vue';
import ProfileHoverCard from './ProfileHoverCard.vue';
import type { Conversation } from '../../types/chat';
import {
  getConversationInitials,
  getConversationKindLabel,
  getConversationName,
  getConversationUser,
} from '../../utils/chatPresentation';
import { formatUsername } from '../../utils/userPresentation';

interface Props {
  conversation: Conversation | null;
  placement?: 'right' | 'bottom';
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'right',
});

const avatarUrl = computed(() => (
  props.conversation?.isGroup
    ? props.conversation.avatarGroup
    : getConversationUser(props.conversation)?.avatar
));

const statusLabel = computed(() => {
  if (props.conversation?.isGroup) return `${props.conversation.memberCount ?? 0} members`;
  return props.conversation?.isOnline ? 'Online' : 'Offline';
});

const description = computed(() => (
  props.conversation?.isGroup
    ? getConversationInitials(props.conversation)
    : 'Direct realtime chat'
));
</script>

<template>
  <ProfileHoverCard
    :user-id="!props.conversation?.isGroup ? getConversationUser(props.conversation)?.id : undefined"
    :avatar-url="avatarUrl"
    :description="description"
    :eyebrow="getConversationKindLabel(props.conversation)"
    :is-online="!props.conversation?.isGroup && props.conversation?.isOnline"
    :name="getConversationName(props.conversation)"
    :placement="props.placement"
    :show-status="!props.conversation?.isGroup"
    :status-label="statusLabel"
    :username="!props.conversation?.isGroup ? formatUsername(getConversationUser(props.conversation)?.username) : undefined"
    z-index-class="z-[120]"
  >
    <slot />
  </ProfileHoverCard>
</template>
