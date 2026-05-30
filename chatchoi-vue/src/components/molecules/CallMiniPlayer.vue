<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import { useCallMediaStore } from '../../stores/call-media';
import { useCallStore } from '../../stores/call';
import { useChatStore } from '../../stores/chat';
import { getConversationName, getConversationUser } from '../../utils/chatPresentation';
import type { CallVideoTrack } from '../../services/call-media.service';

const callStore = useCallStore();
const callMediaStore = useCallMediaStore();
const chatStore = useChatStore();

const call = computed(() => callStore.activeOverlayCall);
const isVisible = computed(() => Boolean(call.value) && !callStore.isCallExpanded);

const conversation = computed(() => {
  if (!call.value) return null;
  return chatStore.conversations.find((c) => c.id === call.value!.conversationId) ?? null;
});

const title = computed(() => getConversationName(conversation.value));
const avatarUrl = computed(() => {
  if (!conversation.value) return call.value?.startedBy.avatar ?? null;
  return conversation.value.isGroup
    ? conversation.value.avatarGroup
    : getConversationUser(conversation.value)?.avatar;
});

const localParticipant = computed(() => {
  if (!call.value) return null;
  return call.value.participants.find((p) => p.userId === chatStore.myId) ?? null;
});

const localVideoTrack = computed<CallVideoTrack | null>(() => {
  if (!call.value || !chatStore.myId) return null;
  return callMediaStore.getVideoTrackForUser(chatStore.myId);
});

const isTakenOver = computed(() => callMediaStore.connectionStatus === 'taken_over');
const showVideo = computed(
  () => localVideoTrack.value && localParticipant.value?.cameraEnabled && !isTakenOver.value,
);

// Video attach/detach
const videoEl = ref<HTMLVideoElement | null>(null);
let attachedTrack: CallVideoTrack | null = null;

const syncVideo = () => {
  if (attachedTrack && videoEl.value) attachedTrack.detach(videoEl.value);
  attachedTrack = null;
  if (!localVideoTrack.value || !videoEl.value) return;
  attachedTrack = localVideoTrack.value;
  localVideoTrack.value.attach(videoEl.value);
  videoEl.value.autoplay = true;
  videoEl.value.playsInline = true;
  videoEl.value.muted = true;
};

watch(localVideoTrack, syncVideo);
watch(videoEl, syncVideo);
onBeforeUnmount(() => {
  if (attachedTrack && videoEl.value) attachedTrack.detach(videoEl.value);
});

// ─── Collapsed (pill) mode ─────────────────────────────────────────────────
const isCollapsed = ref(false);
const toggleCollapsed = () => { isCollapsed.value = !isCollapsed.value; };

// ─── Drag & drop ────────────────────────────────────────────────────────────
// Position stored as offset from bottom-right (so default = bottom-4 right-4)
const MARGIN = 16;
const playerEl = ref<HTMLElement | null>(null);

// We track position from bottom-right edge so default matches CSS `bottom-4 right-4`
const pos = ref({ right: MARGIN, bottom: MARGIN });
let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let startRight = MARGIN;
let startBottom = MARGIN;
// Whether any actual movement happened (to distinguish click from drag)
let didMove = false;

const onPointerDown = (e: PointerEvent) => {
  // Only drag on primary button; allow buttons inside to work
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  if (target.closest('button')) return;

  dragging = true;
  didMove = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  startRight = pos.value.right;
  startBottom = pos.value.bottom;

  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  e.preventDefault();
};

const onPointerMove = (e: PointerEvent) => {
  if (!dragging || !playerEl.value) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;

  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didMove = true;

  const w = playerEl.value.offsetWidth;
  const h = playerEl.value.offsetHeight;
  const maxRight = window.innerWidth - w - MARGIN;
  const maxBottom = window.innerHeight - h - MARGIN;

  pos.value = {
    right: Math.max(MARGIN, Math.min(maxRight, startRight - dx)),
    bottom: Math.max(MARGIN, Math.min(maxBottom, startBottom - dy)),
  };
};

const onPointerUp = (e: PointerEvent) => {
  if (!dragging) return;
  dragging = false;
  // If no actual drag occurred on the collapsed pill → treat as expand click
  if (!didMove && isCollapsed.value) {
    isCollapsed.value = false;
  }
};

onMounted(() => {
  window.addEventListener('resize', clampToViewport);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', clampToViewport);
});

const clampToViewport = () => {
  if (!playerEl.value) return;
  const w = playerEl.value.offsetWidth;
  const h = playerEl.value.offsetHeight;
  pos.value = {
    right: Math.max(MARGIN, Math.min(window.innerWidth - w - MARGIN, pos.value.right)),
    bottom: Math.max(MARGIN, Math.min(window.innerHeight - h - MARGIN, pos.value.bottom)),
  };
};

// Actions
const handleExpand = () => { callStore.isCallExpanded = true; };

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

const handleLeave = () => {
  if (!call.value) return;
  void callMediaStore.disconnectForCall(call.value.id);
  callStore.leaveCall(call.value.id);
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-3 opacity-0 scale-95"
      enter-to-class="translate-y-0 opacity-100 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100 scale-100"
      leave-to-class="translate-y-3 opacity-0 scale-95"
    >
      <div
        v-if="isVisible && call"
        ref="playerEl"
        class="fixed z-40 select-none touch-none"
        :style="{ right: pos.right + 'px', bottom: pos.bottom + 'px' }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >

        <!-- ── COLLAPSED pill ─────────────────────────────────────── -->
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="scale-90 opacity-0"
          enter-to-class="scale-100 opacity-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="scale-100 opacity-100"
          leave-to-class="scale-90 opacity-0"
          mode="out-in"
        >
          <div
            v-if="isCollapsed"
            class="flex items-center gap-2 h-10 pl-2.5 pr-1.5 rounded-full bg-surface-container-lowest/95 backdrop-blur border border-outline-variant shadow-xl cursor-pointer"
            @click="isCollapsed = false"
          >
            <!-- live pulse dot -->
            <span class="relative flex h-2 w-2 shrink-0">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60"></span>
              <span class="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
            </span>

            <span class="text-xs font-semibold text-on-surface max-w-[100px] truncate">{{ title }}</span>

            <!-- Mic status dot -->
            <span
              class="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
              :class="localParticipant?.micEnabled ? 'text-on-surface-variant' : 'text-error'"
            >
              <span class="material-symbols-outlined text-[14px]">
                {{ localParticipant?.micEnabled ? 'mic' : 'mic_off' }}
              </span>
            </span>

            <!-- End call -->
            <button
              class="h-7 w-7 rounded-full bg-error text-on-error flex items-center justify-center hover:bg-error/90"
              type="button"
              aria-label="Rời cuộc gọi"
              @click.stop="handleLeave"
            >
              <span class="material-symbols-outlined text-[14px]">call_end</span>
            </button>
          </div>

          <!-- ── EXPANDED mini player ───────────────────────────────── -->
          <div
            v-else
            class="w-60 rounded-2xl bg-surface-container-lowest/95 backdrop-blur shadow-2xl border border-outline-variant overflow-hidden"
          >
            <!-- Drag handle bar -->
            <div class="h-6 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing">
              <div class="h-1 w-8 rounded-full bg-outline-variant mx-auto"></div>
              <!-- Collapse to pill -->
              <button
                class="absolute right-2 top-1 h-5 w-5 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface"
                type="button"
                aria-label="Thu nhỏ tối đa"
                @click.stop="toggleCollapsed"
              >
                <span class="material-symbols-outlined text-[13px]">remove</span>
              </button>
            </div>

            <!-- Video / Avatar area (click → full expand) -->
            <div
              class="relative aspect-video bg-black/90 flex items-center justify-center cursor-pointer"
              @click="handleExpand"
            >
              <video
                v-show="showVideo"
                ref="videoEl"
                class="absolute inset-0 h-full w-full object-cover"
              />

              <div v-if="!showVideo" class="flex flex-col items-center gap-2 pointer-events-none">
                <Avatar :avatar-url="avatarUrl" :name="title" size="lg" />
                <p class="text-xs font-semibold text-white/90 truncate max-w-[200px] px-3">{{ title }}</p>
              </div>

              <!-- Expand icon overlay -->
              <div class="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/40 flex items-center justify-center text-white/70 pointer-events-none">
                <span class="material-symbols-outlined text-[14px]">open_in_full</span>
              </div>

              <!-- Taken over badge -->
              <div
                v-if="isTakenOver"
                class="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm px-3 py-1 text-center"
              >
                <p class="text-[10px] text-white/80">Đang hoạt động ở nơi khác</p>
              </div>
            </div>

            <!-- Controls bar -->
            <div class="px-2.5 py-2 flex items-center gap-1">
              <div class="flex-1 min-w-0">
                <p class="text-[11px] text-secondary truncate">
                  {{ call.kind === 'video' ? 'Video' : 'Thoại' }} · {{ call.activeParticipantCount }} người
                </p>
              </div>

              <button
                class="h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
                :class="localParticipant?.micEnabled ? 'text-on-surface hover:bg-surface-container-high' : 'bg-error/15 text-error'"
                type="button"
                :aria-label="localParticipant?.micEnabled ? 'Tắt micro' : 'Bật micro'"
                @click.stop="handleToggleMic"
              >
                <span class="material-symbols-outlined text-[16px]">{{ localParticipant?.micEnabled ? 'mic' : 'mic_off' }}</span>
              </button>

              <button
                class="h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors"
                :class="localParticipant?.cameraEnabled ? 'text-on-surface hover:bg-surface-container-high' : 'bg-error/15 text-error'"
                type="button"
                :aria-label="localParticipant?.cameraEnabled ? 'Tắt camera' : 'Bật camera'"
                @click.stop="handleToggleCamera"
              >
                <span class="material-symbols-outlined text-[16px]">{{ localParticipant?.cameraEnabled ? 'videocam' : 'videocam_off' }}</span>
              </button>

              <button
                class="h-7 w-7 rounded-full bg-error text-on-error flex items-center justify-center shrink-0 hover:bg-error/90 transition-colors"
                type="button"
                aria-label="Rời cuộc gọi"
                @click.stop="handleLeave"
              >
                <span class="material-symbols-outlined text-[16px]">call_end</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
