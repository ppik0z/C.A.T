<script setup lang="ts">
import { computed } from 'vue';
import ProfileHoverCard from './ProfileHoverCard.vue';
import { resolveDisplayName, formatUsername } from '../../utils/userPresentation';
import type { ConversationMember } from '../../types/chat';

interface Props {
  member: ConversationMember;
  placement?: 'right' | 'bottom';
}

const props = withDefaults(defineProps<Props>(), {
  placement: 'right',
});

const roleLabel = computed(() => (props.member.isAdmin ? 'Group admin' : 'Group member'));
const description = computed(() => props.member.nickname || 'Member profile');
</script>

<template>
  <ProfileHoverCard
    :user-id="props.member.userId"
    :avatar-url="props.member.avatar"
    :description="description"
    :eyebrow="roleLabel"
    :is-online="props.member.isOnline"
    :name="resolveDisplayName(props.member)"
    :placement="props.placement"
    :status-label="props.member.isOnline ? 'Online' : 'Offline'"
    :username="formatUsername(props.member.username)"
    z-index-class="z-[130]"
  >
    <slot />
  </ProfileHoverCard>
</template>
