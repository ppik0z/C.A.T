<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue';
import { ChevronLeft, ChevronRight, Minimize2, MonitorSmartphone, Phone, Video } from '@lucide/vue';
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
const isVideoCall = computed(() => kind.value === 'video');
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
const stageParticipants = computed(() => {
  if (!isVideoCall.value || conversation.value?.isGroup || chatStore.myId === null) {
    return displayedParticipants.value;
  }

  const remoteParticipants = displayedParticipants.value.filter((participant) => {
    return participant.userId !== chatStore.myId;
  });
  return remoteParticipants.length > 0 ? remoteParticipants : displayedParticipants.value;
});
const pageCount = computed(() => {
  return Math.max(1, Math.ceil(joinedParticipants.value.length / callMediaStore.videoPageSize));
});
const participantGridClass = computed(() => {
  const count = stageParticipants.value.length;
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  return 'grid-cols-2 lg:grid-cols-3';
});
const localParticipant = computed(() => {
  const myId = chatStore.myId;
  if (!myId || !call.value) return null;
  return call.value.participants.find((participant) => participant.userId === myId) ?? null;
});
const showLocalPreview = computed(() => {
  return Boolean(
    isVideoCall.value
      && call.value
      && !conversation.value?.isGroup
      && localParticipant.value,
  );
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
      class="fixed inset-0 z-40 flex items-center justify-center bg-neutral-950 text-white sm:bg-black/75 sm:p-3 sm:backdrop-blur-xl"
    >
      <section class="relative flex h-full w-full flex-col overflow-hidden bg-neutral-950 shadow-2xl sm:h-[min(52rem,calc(100dvh-1.5rem))] sm:max-w-6xl sm:rounded-[2rem] sm:border sm:border-white/10">
        <div
          v-if="!isVideoCall"
          class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,color-mix(in_srgb,var(--color-primary)_32%,transparent),transparent_46%),linear-gradient(180deg,#18181b_0%,#09090b_100%)]"
          aria-hidden="true"
        ></div>

        <header class="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <div class="min-w-0">
            <h2 class="truncate text-base font-bold text-white sm:text-lg">{{ title }}</h2>
            <p class="truncate text-sm text-white/70">
              {{ isVideoCall ? 'Cuộc gọi video' : 'Cuộc gọi thoại' }} · {{ statusText }}
            </p>
            <p v-if="mediaStatusText" class="truncate text-xs text-white/55">{{ mediaStatusText }}</p>
          </div>
          <button
            v-if="call"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            type="button"
            aria-label="Thu nhỏ"
            @click="handleMinimize"
          >
            <Minimize2 :size="19" aria-hidden="true" />
          </button>
        </header>

        <div
          v-if="callMediaStore.error"
          class="absolute inset-x-4 top-24 z-30 rounded-xl border border-error/30 bg-error-container px-4 py-2 text-sm text-on-error-container shadow-lg sm:inset-x-6"
        >
          {{ callMediaStore.error }}
        </div>

        <main class="relative z-10 min-h-0 flex-1">
          <div v-if="isTakenOver" class="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
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

          <div
            v-else-if="isVideoCall && stageParticipants.length > 0"
            :class="[
              'grid h-full auto-rows-fr gap-2 overflow-y-auto px-2 pb-28 pt-24 sm:gap-3 sm:px-3 sm:pb-32',
              participantGridClass,
            ]"
          >
            <CallParticipantTile
              v-for="participant in stageParticipants"
              :key="participant.userId"
              :participant="participant"
              :video-track="callMediaStore.getVideoTrackForUser(participant.userId)"
              :is-active-speaker="callMediaStore.isActiveSpeaker(participant.userId)"
            />
          </div>

          <div v-else class="flex h-full flex-col items-center justify-center px-6 pb-28 pt-24 text-center sm:pb-32">
            <div class="rounded-full bg-white/8 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.45)] ring-1 ring-white/10">
              <Avatar :avatar-url="avatarUrl" :name="title" size="2xl" />
            </div>
            <p class="mt-6 max-w-md truncate text-2xl font-bold text-white sm:text-3xl">{{ title }}</p>
            <p class="mt-2 text-sm font-medium text-white/65">{{ statusText }}</p>
            <span class="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/85">
              <Video v-if="isVideoCall" :size="20" aria-hidden="true" />
              <Phone v-else :size="20" aria-hidden="true" />
            </span>
          </div>
        </main>

        <div
          v-if="showLocalPreview && localParticipant"
          class="absolute bottom-32 right-3 z-20 aspect-[3/4] w-28 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15 sm:bottom-36 sm:right-5 sm:w-40"
        >
          <CallParticipantTile
            compact
            :participant="localParticipant"
            :video-track="callMediaStore.getVideoTrackForUser(localParticipant.userId)"
            :is-active-speaker="callMediaStore.isActiveSpeaker(localParticipant.userId)"
          />
        </div>

        <footer class="absolute inset-x-0 bottom-0 z-20 flex items-end justify-center gap-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-12 sm:gap-5 sm:pb-6">
          <button
            v-if="call && pageCount > 1"
            class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40"
            type="button"
            aria-label="Trang trước"
            :disabled="callMediaStore.videoPageIndex === 0"
            @click="callMediaStore.previousVideoPage(call)"
          >
            <ChevronLeft :size="21" />
          </button>
          <div v-if="call" class="flex flex-col items-center gap-1.5">
            <CallControlButton
              :active="Boolean(localParticipant?.micEnabled)"
              :icon="localParticipant?.micEnabled ? 'mic' : 'mic_off'"
              label="Bật/tắt micro"
              @click="handleToggleMic"
            />
            <span class="text-[11px] font-semibold text-white/70">Micro</span>
          </div>
          <div v-if="call" class="flex flex-col items-center gap-1.5">
            <CallControlButton
              :active="Boolean(localParticipant?.cameraEnabled)"
              :icon="localParticipant?.cameraEnabled ? 'videocam' : 'videocam_off'"
              label="Bật/tắt camera"
              @click="handleToggleCamera"
            />
            <span class="text-[11px] font-semibold text-white/70">Camera</span>
          </div>
          <div class="flex flex-col items-center gap-1.5">
            <CallControlButton icon="call_end" label="Rời cuộc gọi" tone="danger" @click="handleLeave" />
            <span class="text-[11px] font-semibold text-white/70">Kết thúc</span>
          </div>
          <button
            v-if="call && pageCount > 1"
            class="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-40"
            type="button"
            aria-label="Trang sau"
            :disabled="callMediaStore.videoPageIndex >= pageCount - 1"
            @click="callMediaStore.nextVideoPage(call)"
          >
            <ChevronRight :size="21" />
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
