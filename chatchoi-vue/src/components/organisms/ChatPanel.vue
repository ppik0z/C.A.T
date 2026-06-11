<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import ActiveCallBanner from '../molecules/ActiveCallBanner.vue';
import ChatHeader from '../molecules/ChatHeader.vue';
import ComposerBar from '../molecules/ComposerBar.vue';
import MessageBubble from '../molecules/MessageBubble.vue';
import { useCallStore } from '../../stores/call';
import { useChatStore } from '../../stores/chat';
import type { CallKind } from '../../types/call';
import type { ChatMessage, Conversation } from '../../types/chat';
import { formatMessageDateDivider, getMessageDateKey } from '../../utils/chatPresentation';
import { resolveDisplayName } from '../../utils/userPresentation';

interface Props {
  conversation: Conversation | null;
  detailsOpen: boolean;
  searchOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  back: [];
  closeSearch: [];
  toggleDetails: [];
}>();

const chatStore = useChatStore();
const callStore = useCallStore();
const scrollRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const searchText = ref('');
const pendingScrollAnchorIndex = ref<number | null>(null);
const pendingPrependHeight = ref<number | null>(null);
const pendingPrependAnchor = ref<{ key: string; top: number } | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const BOTTOM_SCROLL_THRESHOLD_PX = 160;

const sortedMessages = computed(() => {
  return [...chatStore.currentMessages].sort((a, b) => {
    const indexA = a.conversationIndex ?? Number.MAX_SAFE_INTEGER;
    const indexB = b.conversationIndex ?? Number.MAX_SAFE_INTEGER;
    if (indexA !== indexB) return indexA - indexB;
    return a.id - b.id;
  });
});

const messageGroups = computed(() => {
  return sortedMessages.value.reduce<Array<{ key: string; label: string; messages: ChatMessage[] }>>((groups, message) => {
    const key = getMessageDateKey(message);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.key === key) {
      lastGroup.messages.push(message);
      return groups;
    }

    groups.push({
      key,
      label: formatMessageDateDivider(message.createdAt),
      messages: [message],
    });
    return groups;
  }, []);
});

const currentWindowMode = computed(() => {
  return props.conversation ? chatStore.messageWindowModeByConversationId[props.conversation.id] : 'latest';
});

const currentLoadState = computed(() => {
  return props.conversation ? chatStore.messageLoadStateByConversationId[props.conversation.id] : 'idle';
});

const isLoadingOlderMessages = computed(() => {
  const conversationId = props.conversation?.id;
  if (!conversationId) return false;
  return chatStore.messageLoadDirectionByConversationId[conversationId] === 'older' && currentLoadState.value === 'loading';
});

const messageListSignature = computed(() => {
  return sortedMessages.value.map((message) => {
    return [
      message.conversationIndex ?? 'local',
      message.clientTempId ?? message.id,
      message.localStatus ?? 'remote',
    ].join(':');
  }).join('|');
});

const latestMessage = computed(() => sortedMessages.value[sortedMessages.value.length - 1] ?? null);

const latestMessageIdentity = computed(() => {
  const message = latestMessage.value;
  if (!message) return null;

  return {
    key: [
      props.conversation?.id ?? 'none',
      message.conversationIndex ?? 'local',
      message.clientTempId ?? message.id,
    ].join(':'),
    sortIndex: message.conversationIndex ?? Number.MAX_SAFE_INTEGER,
    id: message.id,
    isOwn: isOwnMessage(message),
  };
});

const typingLabel = computed(() => {
  if (!props.conversation) return '';
  const users = chatStore.typingUsersByConversationId[props.conversation.id] ?? [];
  if (users.length === 0) return '';
  if (users.length === 1) return `${resolveDisplayName(users[0])} đang soạn tin...`;
  return `${users.length} người đang soạn tin...`;
});

const currentPageInfo = computed(() => {
  return props.conversation ? chatStore.messagePageInfoByConversationId[props.conversation.id] : null;
});

const currentSearchState = computed(() => {
  return props.conversation
    ? chatStore.messageSearchStateByConversationId[props.conversation.id]
    : null;
});

const currentMembers = computed(() => {
  if (!props.conversation?.isGroup) return [];
  return chatStore.conversationDetailsById[props.conversation.id]?.members ?? props.conversation.members ?? [];
});

const activeSearchResult = computed(() => {
  const state = currentSearchState.value;
  if (!state || state.activeResultIndex < 0) return null;
  return state.results[state.activeResultIndex] ?? null;
});

const canNavigateToOlderSearchResult = computed(() => {
  const state = currentSearchState.value;
  return Boolean(state && state.activeResultIndex > 0);
});

const canNavigateToNewerSearchResult = computed(() => {
  const state = currentSearchState.value;
  return Boolean(state && state.activeResultIndex >= 0 && state.activeResultIndex < state.results.length - 1);
});

const getSenderId = (message: ChatMessage) => message.senderId ?? message.sender?.id;
const isOwnMessage = (message: ChatMessage) => getSenderId(message) === chatStore.myId;
const isActiveSearchMessage = (message: ChatMessage) => {
  return Boolean(activeSearchResult.value && message.conversationIndex === activeSearchResult.value.conversationIndex);
};
const getMessageDomKey = (message: ChatMessage) => {
  return [
    message.conversationIndex ?? 'local',
    message.clientTempId ?? message.id,
  ].join(':');
};

const isNearBottom = () => {
  const element = scrollRef.value;
  if (!element) return false;
  return element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_SCROLL_THRESHOLD_PX;
};

const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
  const element = scrollRef.value;
  if (!element) return;
  element.scrollTo({ top: element.scrollHeight, behavior });
};

const scrollToPendingAnchor = (behavior: ScrollBehavior = 'smooth') => {
  const element = scrollRef.value;
  const anchorIndex = pendingScrollAnchorIndex.value;
  if (!element || anchorIndex === null) return false;

  const target = element.querySelector<HTMLElement>(`[data-message-index="${anchorIndex}"]`);
  if (!target) return false;

  target.scrollIntoView({ block: 'center', behavior });
  pendingScrollAnchorIndex.value = null;
  return true;
};

const captureFirstVisibleMessageAnchor = () => {
  const element = scrollRef.value;
  if (!element) return null;

  const containerTop = element.getBoundingClientRect().top;
  const messageElements = Array.from(element.querySelectorAll<HTMLElement>('[data-message-key]'));
  const firstVisible = messageElements.find((messageElement) => {
    return messageElement.getBoundingClientRect().bottom >= containerTop;
  });

  if (!firstVisible) return null;

  return {
    key: firstVisible.dataset.messageKey ?? '',
    top: firstVisible.getBoundingClientRect().top - containerTop,
  };
};

const restorePrependAnchor = () => {
  const element = scrollRef.value;
  const anchor = pendingPrependAnchor.value;
  if (!element || !anchor) return false;

  const target = element.querySelector<HTMLElement>(`[data-message-key="${CSS.escape(anchor.key)}"]`);
  pendingPrependAnchor.value = null;
  if (!target) return false;

  const nextTop = target.getBoundingClientRect().top - element.getBoundingClientRect().top;
  element.scrollTop += nextTop - anchor.top;
  return true;
};

const shouldScrollForLatestMessage = (
  previous: typeof latestMessageIdentity.value,
  next: typeof latestMessageIdentity.value,
  wasNearBottom: boolean,
) => {
  if (!next || currentWindowMode.value === 'search' || pendingPrependHeight.value !== null) return false;
  if (next.isOwn) return true;
  if (!previous) return false;
  if (!wasNearBottom || previous.key === next.key) return false;
  if (next.sortIndex > previous.sortIndex) return true;
  return next.sortIndex === previous.sortIndex && next.id > previous.id;
};

const handleScroll = () => {
  const element = scrollRef.value;
  const conversationId = props.conversation?.id;
  if (!element || !conversationId) return;

  if (element.scrollTop < 120 && currentPageInfo.value?.hasOlder) {
    const anchor = captureFirstVisibleMessageAnchor();
    const didRequest = chatStore.loadOlderMessages(conversationId);
    if (didRequest) {
      pendingPrependAnchor.value = anchor;
      pendingPrependHeight.value = element.scrollHeight;
    }
    return;
  }

  const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
  if (
    distanceFromBottom < 120 &&
    currentPageInfo.value?.hasNewer &&
    chatStore.messageWindowModeByConversationId[conversationId] === 'search'
  ) {
    chatStore.loadNewerMessages(conversationId);
  }
};

const handleSearchInput = () => {
  if (!props.conversation) return;
  if (searchTimer) clearTimeout(searchTimer);

  searchTimer = setTimeout(() => {
    if (!props.conversation) return;
    chatStore.searchMessages(props.conversation.id, searchText.value);
  }, 250);
};

const navigateSearch = (direction: 'previous' | 'next') => {
  if (!props.conversation) return;
  const result = chatStore.navigateSearchResult(props.conversation.id, direction);
  if (result) {
    pendingScrollAnchorIndex.value = result.conversationIndex;
  }
};

const closeSearch = () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchText.value = '';
  pendingScrollAnchorIndex.value = null;
  if (props.conversation) {
    chatStore.clearMessageSearch(props.conversation.id);
  }
  emit('closeSearch');
};

const handleStartCall = (kind: CallKind) => {
  if (!props.conversation) return;
  callStore.startCall(props.conversation.id, kind);
};

watch(
  () => props.conversation?.id,
  () => {
    searchText.value = '';
    pendingScrollAnchorIndex.value = null;
    pendingPrependHeight.value = null;
    pendingPrependAnchor.value = null;
    chatStore.clearReplyTarget();
    if (props.conversation?.isGroup) {
      void chatStore.loadConversationDetail(props.conversation.id);
    }
    void nextTick(() => scrollToBottom('auto'));
  },
);

watch(
  () => props.searchOpen,
  async (isOpen) => {
    if (isOpen) {
      await nextTick();
      searchInputRef.value?.focus();
      return;
    }

    if (searchText.value && props.conversation) {
      searchText.value = '';
      chatStore.clearMessageSearch(props.conversation.id);
    }
  },
);

watch(
  () => currentPageInfo.value?.anchorIndex,
  (anchorIndex) => {
    if (anchorIndex) pendingScrollAnchorIndex.value = anchorIndex;
  },
);

watch(
  () => activeSearchResult.value?.conversationIndex,
  async (anchorIndex) => {
    if (!anchorIndex) return;
    pendingScrollAnchorIndex.value = anchorIndex;
    await nextTick();
    scrollToPendingAnchor();
  },
);

watch(
  () => messageListSignature.value,
  async () => {
    await nextTick();
    const element = scrollRef.value;
    if (!element) return;

    if (pendingPrependHeight.value !== null) {
      const didRestoreAnchor = restorePrependAnchor();
      if (!didRestoreAnchor) {
        element.scrollTop = element.scrollHeight - pendingPrependHeight.value + element.scrollTop;
      }
      pendingPrependHeight.value = null;
    }

    scrollToPendingAnchor();
  },
);

watch(
  () => latestMessageIdentity.value,
  async (next, previous) => {
    const wasNearBottom = isNearBottom();
    const shouldScroll = shouldScrollForLatestMessage(previous, next, wasNearBottom);
    await nextTick();
    if (shouldScroll) scrollToBottom();
  },
);

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <section class="h-full min-w-0 flex flex-col bg-chat-canvas overflow-hidden relative">
    <template v-if="props.conversation">
      <ChatHeader
        :conversation="props.conversation"
        :details-open="props.detailsOpen"
        @back="emit('back')"
        @start-call="handleStartCall"
        @toggle-details="emit('toggleDetails')"
      />

      <ActiveCallBanner :conversation="props.conversation" />

      <div
        v-if="props.searchOpen"
        class="px-4 sm:px-6 py-3 bg-surface-container-lowest border-b border-outline-variant"
      >
        <div class="flex items-center gap-2">
          <div class="flex-1 min-w-0 flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
            <span class="material-symbols-outlined text-[18px] text-secondary">search</span>
            <input
              ref="searchInputRef"
              v-model="searchText"
              class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-outline"
              placeholder="Tìm tin nhắn..."
              type="search"
              @input="handleSearchInput"
            />
          </div>

          <button
            class="h-9 w-9 rounded-full text-secondary hover:bg-surface-container-highest disabled:opacity-40"
            type="button"
            :disabled="!canNavigateToOlderSearchResult"
            @click="navigateSearch('previous')"
          >
            <span class="material-symbols-outlined text-[20px]">keyboard_arrow_up</span>
          </button>
          <button
            class="h-9 w-9 rounded-full text-secondary hover:bg-surface-container-highest disabled:opacity-40"
            type="button"
            :disabled="!canNavigateToNewerSearchResult"
            @click="navigateSearch('next')"
          >
            <span class="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
          </button>
          <button
            class="h-9 w-9 rounded-full text-secondary hover:bg-surface-container-highest"
            type="button"
            aria-label="Đóng tìm kiếm"
            @click="closeSearch"
          >
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
          <span class="w-16 text-right text-xs text-secondary">
            <template v-if="currentSearchState?.loading">...</template>
            <template v-else-if="currentSearchState && currentSearchState.results.length > 0">
              {{ currentSearchState.activeResultIndex + 1 }}/{{ currentSearchState.results.length }}
            </template>
            <template v-else>0/0</template>
          </span>
        </div>
        <p v-if="currentSearchState?.error" class="mt-2 text-xs text-error">{{ currentSearchState.error }}</p>
      </div>

      <div
        ref="scrollRef"
        class="chat-thread-surface flex-1 min-h-0 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5 flex flex-col gap-2.5 sm:gap-3 thin-scrollbar"
        @scroll.passive="handleScroll"
      >
        <div
          v-if="isLoadingOlderMessages"
          class="flex justify-center py-1 text-xs font-semibold text-secondary"
          aria-live="polite"
        >
          Đang tải tin nhắn cũ...
        </div>

        <template v-for="group in messageGroups" :key="group.key">
          <div class="flex justify-center">
            <span class="rounded-full border border-outline-variant/70 bg-surface-container-lowest/85 px-3 py-1 text-[11px] font-semibold text-on-surface-variant shadow-sm backdrop-blur-sm">
              {{ group.label }}
            </span>
          </div>

          <div
            v-for="message in group.messages"
            :key="message.id"
            :data-message-index="message.conversationIndex"
            :data-message-key="getMessageDomKey(message)"
            :class="[
              'rounded-2xl transition-shadow duration-200',
              isActiveSearchMessage(message) ? 'ring-2 ring-primary/40' : 'ring-0 ring-transparent',
            ]"
          >
            <MessageBubble
              :is-own="isOwnMessage(message)"
              :message="message"
              :status-text="isOwnMessage(message) ? chatStore.getMessageDisplayStatus(message, props.conversation) : undefined"
              @react="chatStore.setReaction"
              @recall="chatStore.recallMessage"
              @remove-reaction="chatStore.removeReaction"
              @reply="chatStore.setReplyTarget"
              @retry-media="chatStore.retryMediaMessage"
            />
          </div>
        </template>
      </div>

      <div
        v-if="typingLabel"
        class="chat-thread-surface px-4 sm:px-6 py-2 text-xs text-on-surface-variant flex items-center gap-2"
      >
        <span class="inline-flex gap-[2px]">
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </span>
        <span>{{ typingLabel }}</span>
      </div>

      <ComposerBar
        :is-group="Boolean(props.conversation?.isGroup)"
        :members="currentMembers"
        :reply-target="chatStore.replyTarget"
        @cancel-reply="chatStore.clearReplyTarget"
        @send="chatStore.sendMessage"
        @send-media="chatStore.sendMediaMessage"
        @typing-start="props.conversation && chatStore.startTyping(props.conversation.id)"
        @typing-stop="props.conversation && chatStore.stopTyping(props.conversation.id)"
      />
    </template>

    <div v-else class="chat-thread-surface flex-1 flex flex-col items-center justify-center text-on-surface-variant px-6 text-center">
      <div class="w-20 h-20 rounded-full bg-primary-container text-primary flex items-center justify-center mb-4">
        <span class="material-symbols-outlined text-[40px]">chat</span>
      </div>
      <h2 class="text-xl font-bold mb-2 text-on-surface">Chào mừng</h2>
      <p class="text-sm">Hãy chọn một đoạn chat để bắt đầu gửi tin nhắn</p>
    </div>
  </section>
</template>

<style scoped>
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

:deep(.animate-slide-in) {
  animation: slide-in 0.3s ease-out;
}
</style>
