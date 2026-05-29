<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import CallControlButton from '../atoms/CallControlButton.vue';
import CallParticipantTile from '../molecules/CallParticipantTile.vue';
import { useCallMediaStore } from '../../stores/call-media';
import { useCallStore } from '../../stores/call';
import { useChatStore } from '../../stores/chat';
import { getConversationName, getConversationUser } from '../../utils/chatPresentation';

const callStore = useCallStore();
const callMediaStore = useCallMediaStore();
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
const visibleJoinedParticipants = computed(() => {
  const startIndex = callMediaStore.videoPageIndex * callMediaStore.videoPageSize;
  return joinedParticipants.value.slice(startIndex, startIndex + callMediaStore.videoPageSize);
});
const displayedParticipants = computed(() => {
  if (!call.value) return [];
  const waiting = call.value.participants.filter((participant) => participant.status !== 'joined');
  return [...visibleJoinedParticipants.value, ...waiting];
});
const pageCount = computed(() => {
  return Math.max(1, Math.ceil(joinedParticipants.value.length / callMediaStore.videoPageSize));
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
const mediaStatusText = computed(() => {
  if (!call.value || call.value.provider !== 'livekit' || call.value.currentUserStatus !== 'joined') return null;
  if (callMediaStore.connectionStatus === 'taken_over') return 'Đang hoạt động trên tab/thiết bị khác';
  if (callMediaStore.connectionStatus === 'connecting') return 'Đang kết nối media...';
  if (callMediaStore.connectionStatus === 'reconnecting') return 'Đang kết nối lại media...';
  if (callMediaStore.connectionStatus === 'connected') return 'Media đã kết nối';
  if (callMediaStore.connectionStatus === 'failed') return 'Không thể kết nối media';
  return null;
});
const isTakenOver = computed(() => callMediaStore.connectionStatus === 'taken_over');

const handleLeave = () => {
  if (call.value) {
    void callMediaStore.disconnectForCall(call.value.id);
    callStore.leaveCall(call.value.id);
    return;
  }
  callStore.pendingOutgoing = null;
};

const handleToggleMic = () => {
  if (!call.value || isTakenOver.value) return;
  const enabled = !localParticipant.value?.micEnabled;
  if (call.value.provider === 'livekit' && callMediaStore.activeCallId === call.value.id) {
    void callMediaStore.setMicEnabled(call.value.id, enabled);
    return;
  }
  callStore.toggleMic(call.value.id);
};

const handleToggleCamera = () => {
  if (!call.value || isTakenOver.value) return;
  const enabled = !localParticipant.value?.cameraEnabled;
  if (call.value.provider === 'livekit' && callMediaStore.activeCallId === call.value.id) {
    void callMediaStore.setCameraEnabled(call.value.id, enabled);
    return;
  }
  callStore.toggleCamera(call.value.id);
};

const handleReconnectHere = () => {
  if (!call.value) return;
  callMediaStore.connectionStatus = 'idle';
  void callMediaStore.connectForCall(call.value, true);
};

watch(call, (nextCall, previousCall) => {
  if (previousCall && previousCall.id !== nextCall?.id) {
    void callMediaStore.disconnectForCall(previousCall.id, false);
  }

  if (!nextCall || nextCall.provider !== 'livekit' || nextCall.currentUserStatus !== 'joined') {
    if (previousCall) void callMediaStore.disconnectForCall(previousCall.id, false);
    return;
  }

  void callMediaStore.connectForCall(nextCall);
  callMediaStore.syncVideoPage(nextCall);
}, { immediate: true });

watch(() => [
  call.value?.id,
  call.value?.participants.map((participant) => `${participant.userId}:${participant.status}`).join('|'),
  callMediaStore.videoPageIndex,
  callMediaStore.videoPageSize,
], () => {
  if (call.value) callMediaStore.syncVideoPage(call.value);
});

onBeforeUnmount(() => {
  if (call.value) void callMediaStore.disconnectForCall(call.value.id, false);
});
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
              <p v-if="mediaStatusText" class="text-xs text-secondary truncate">{{ mediaStatusText }}</p>
            </div>
          </div>
          <span class="material-symbols-outlined text-primary text-[28px]">
            {{ kind === 'video' ? 'videocam' : 'call' }}
          </span>
        </header>

        <div
          v-if="callMediaStore.error"
          class="border-b border-error/30 bg-error-container px-5 py-2 text-sm text-on-error-container"
        >
          {{ callMediaStore.error }}
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto bg-background/60 p-4 sm:p-6">
          <div v-if="isTakenOver" class="min-h-72 flex flex-col items-center justify-center text-center gap-4">
            <span class="material-symbols-outlined text-[48px] text-secondary">devices</span>
            <p class="text-lg font-bold text-on-surface">Đang hoạt động ở nơi khác</p>
            <p class="text-sm text-secondary max-w-xs">Cuộc gọi đang kết nối trên một tab hoặc thiết bị khác. Bạn có thể chuyển về đây.</p>
            <button
              class="mt-2 h-10 px-6 rounded-full bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              type="button"
              @click="handleReconnectHere"
            >
              Kết nối lại tại đây
            </button>
          </div>

          <div v-else-if="displayedParticipants.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <CallParticipantTile
              v-for="participant in displayedParticipants"
              :key="participant.userId"
              :participant="participant"
              :video-track="callMediaStore.getVideoTrackForUser(participant.userId)"
              :is-active-speaker="callMediaStore.isActiveSpeaker(participant.userId)"
            />
          </div>

          <div v-else class="min-h-72 flex flex-col items-center justify-center text-center">
            <Avatar :avatar-url="avatarUrl" :name="title" size="xl" />
            <p class="mt-4 text-xl font-bold text-on-surface">{{ title }}</p>
            <p class="mt-1 text-sm text-secondary">{{ statusText }}</p>
          </div>
        </div>

        <footer class="px-5 py-4 border-t border-outline-variant bg-surface-container-lowest flex items-center justify-center gap-3">
          <button
            v-if="call && pageCount > 1"
            class="h-11 w-11 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            type="button"
            aria-label="Trang trước"
            :disabled="callMediaStore.videoPageIndex === 0"
            @click="callMediaStore.previousVideoPage(call)"
          >
            <span class="material-symbols-outlined text-[22px]">chevron_left</span>
          </button>
          <CallControlButton
            v-if="call"
            :active="Boolean(localParticipant?.micEnabled)"
            :icon="localParticipant?.micEnabled ? 'mic' : 'mic_off'"
            label="Bật/tắt micro"
            @click="handleToggleMic"
          />
          <CallControlButton
            v-if="call && kind === 'video'"
            :active="Boolean(localParticipant?.cameraEnabled)"
            :icon="localParticipant?.cameraEnabled ? 'videocam' : 'videocam_off'"
            label="Bật/tắt camera"
            @click="handleToggleCamera"
          />
          <CallControlButton icon="call_end" label="Rời cuộc gọi" tone="danger" @click="handleLeave" />
          <button
            v-if="call && pageCount > 1"
            class="h-11 w-11 rounded-full border border-outline-variant text-on-surface hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary"
            type="button"
            aria-label="Trang sau"
            :disabled="callMediaStore.videoPageIndex >= pageCount - 1"
            @click="callMediaStore.nextVideoPage(call)"
          >
            <span class="material-symbols-outlined text-[22px]">chevron_right</span>
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
