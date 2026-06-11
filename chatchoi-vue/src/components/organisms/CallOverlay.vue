<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { Minimize2, MonitorSmartphone, Phone, Video } from '@lucide/vue';
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
const isVisible = computed(() => {
  if (pending.value && !call.value) return true;
  return Boolean(call.value) && callStore.isCallExpanded;
});

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


const handleMinimize = () => {
  callStore.isCallExpanded = false;
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
      class="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950 text-white sm:bg-black/70 sm:p-4 sm:backdrop-blur-md"
    >
      <section class="flex h-full w-full flex-col overflow-hidden bg-neutral-950 shadow-2xl sm:h-[min(46rem,calc(100dvh-2rem))] sm:max-w-5xl sm:rounded-[2rem] sm:border sm:border-white/10">
        <header class="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl sm:px-5 sm:py-4">
          <div class="flex items-center gap-3 min-w-0">
            <Avatar :avatar-url="avatarUrl" :name="title" size="lg" />
            <div class="min-w-0">
              <h2 class="truncate text-base font-bold text-white sm:text-lg">{{ title }}</h2>
              <p class="truncate text-sm text-white/70">
                {{ kind === 'video' ? 'Cuộc gọi video' : 'Cuộc gọi thoại' }} · {{ statusText }}
              </p>
              <p v-if="mediaStatusText" class="truncate text-xs text-white/55">{{ mediaStatusText }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="call"
              class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
              type="button"
              aria-label="Thu nhỏ"
              @click="handleMinimize"
            >
              <Minimize2 class="h-4 w-4" aria-hidden="true" />
            </button>
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-on-primary">
              <Video v-if="kind === 'video'" class="h-5 w-5" aria-hidden="true" />
              <Phone v-else class="h-5 w-5" aria-hidden="true" />
            </span>
          </div>
        </header>

        <div
          v-if="callMediaStore.error"
          class="border-b border-error/30 bg-error-container px-5 py-2 text-sm text-on-error-container"
        >
          {{ callMediaStore.error }}
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto bg-neutral-950 p-3 sm:p-5">
          <div v-if="isTakenOver" class="min-h-72 flex flex-col items-center justify-center text-center gap-4">
            <MonitorSmartphone class="h-12 w-12 text-white/60" aria-hidden="true" />
            <p class="text-lg font-bold text-white">Đang hoạt động ở nơi khác</p>
            <p class="max-w-xs text-sm text-white/65">Cuộc gọi đang kết nối trên một tab hoặc thiết bị khác. Bạn có thể chuyển về đây.</p>
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
            <p class="mt-4 text-xl font-bold text-white">{{ title }}</p>
            <p class="mt-1 text-sm text-white/65">{{ statusText }}</p>
          </div>
        </div>

        <footer class="flex items-center justify-center gap-3 border-t border-white/10 bg-black/45 px-4 py-4 backdrop-blur-xl sm:px-5">
          <button
            v-if="call && pageCount > 1"
            class="h-11 w-11 rounded-full border border-white/15 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-40"
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
            v-if="call"
            :active="Boolean(localParticipant?.cameraEnabled)"
            :icon="localParticipant?.cameraEnabled ? 'videocam' : 'videocam_off'"
            label="Bật/tắt camera"
            @click="handleToggleCamera"
          />
          <CallControlButton icon="call_end" label="Rời cuộc gọi" tone="danger" @click="handleLeave" />
          <button
            v-if="call && pageCount > 1"
            class="h-11 w-11 rounded-full border border-white/15 text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-40"
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
