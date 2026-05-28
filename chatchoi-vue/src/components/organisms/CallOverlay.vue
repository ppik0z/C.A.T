<script setup lang="ts">
import { computed } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import CallControlButton from '../atoms/CallControlButton.vue';
import CallParticipantTile from '../molecules/CallParticipantTile.vue';
import { useCallStore } from '../../stores/call';
import { useChatStore } from '../../stores/chat';
import { getConversationName, getConversationUser } from '../../utils/chatPresentation';

const callStore = useCallStore();
const chatStore = useChatStore();

const call = computed(() => callStore.activeOverlayCall);
const pending = computed(() => callStore.pendingOutgoing);
const isVisible = computed(() => Boolean(call.value || pending.value));

const conversation = computed(() => {
  const conversationId = call.value?.conversationId ?? pending.value?.conversationId;
  if (!conversationId) return null;
  return chatStore.conversations.find((item) => item.id === conversationId) ?? null;
});

const title = computed(() => getConversationName(conversation.value));
const avatarUrl = computed(() => {
  if (!conversation.value) return call.value?.startedBy.avatar ?? null;
  return conversation.value.isGroup ? conversation.value.avatarGroup : getConversationUser(conversation.value)?.avatar;
});

const kind = computed(() => call.value?.kind ?? pending.value?.kind ?? 'audio');
const joinedParticipants = computed(() => {
  return call.value?.participants.filter((participant) => participant.status === 'joined') ?? [];
});
const displayedParticipants = computed(() => {
  if (!call.value) return [];
  const joined = call.value.participants.filter((participant) => participant.status === 'joined');
  const waiting = call.value.participants.filter((participant) => participant.status !== 'joined');
  return [...joined, ...waiting];
});
const localParticipant = computed(() => {
  const myId = chatStore.myId;
  if (!myId || !call.value) return null;
  return call.value.participants.find((participant) => participant.userId === myId) ?? null;
});
const statusText = computed(() => {
  if (pending.value && !call.value) return 'Đang tạo cuộc gọi...';
  if (!call.value) return '';
  if (call.value.status === 'ringing') return 'Đang gọi...';
  return `${joinedParticipants.value.length} người đang tham gia`;
});

const handleLeave = () => {
  if (call.value) {
    callStore.leaveCall(call.value.id);
    return;
  }
  callStore.pendingOutgoing = null;
};
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <section class="w-full max-w-4xl max-h-[calc(100dvh-2rem)] overflow-hidden rounded-lg bg-surface-container-lowest shadow-2xl flex flex-col">
        <header class="px-5 py-4 border-b border-outline-variant flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <Avatar :avatar-url="avatarUrl" :name="title" size="lg" />
            <div class="min-w-0">
              <h2 class="text-lg font-bold text-on-surface truncate">{{ title }}</h2>
              <p class="text-sm text-secondary truncate">
                {{ kind === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại' }} · {{ statusText }}
              </p>
            </div>
          </div>
          <span class="material-symbols-outlined text-primary text-[28px]">
            {{ kind === 'video' ? 'videocam' : 'call' }}
          </span>
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto bg-background/60 p-4 sm:p-6">
          <div
            v-if="displayedParticipants.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <CallParticipantTile
              v-for="participant in displayedParticipants"
              :key="participant.userId"
              :participant="participant"
            />
          </div>

          <div v-else class="min-h-72 flex flex-col items-center justify-center text-center">
            <Avatar :avatar-url="avatarUrl" :name="title" size="xl" />
            <p class="mt-4 text-xl font-bold text-on-surface">{{ title }}</p>
            <p class="mt-1 text-sm text-secondary">{{ statusText }}</p>
          </div>
        </div>

        <footer class="px-5 py-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-center gap-3">
          <CallControlButton
            v-if="call"
            :active="Boolean(localParticipant?.micEnabled)"
            :icon="localParticipant?.micEnabled ? 'mic' : 'mic_off'"
            label="Bật/tắt micro"
            @click="callStore.toggleMic(call.id)"
          />
          <CallControlButton
            v-if="call && kind === 'video'"
            :active="Boolean(localParticipant?.cameraEnabled)"
            :icon="localParticipant?.cameraEnabled ? 'videocam' : 'videocam_off'"
            label="Bật/tắt camera"
            @click="callStore.toggleCamera(call.id)"
          />
          <CallControlButton icon="call_end" label="Rời cuộc gọi" tone="danger" @click="handleLeave" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>
