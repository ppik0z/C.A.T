<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import ChatHeader from '../molecules/ChatHeader.vue';
import ComposerBar from '../molecules/ComposerBar.vue';
import MessageBubble from '../molecules/MessageBubble.vue';
import { useChatStore } from '../../stores/chat';
import type { ChatMessage, Conversation } from '../../types/chat';
import { formatMessageDateDivider, getMessageDateKey } from '../../utils/chatPresentation';

interface Props {
  conversation: Conversation | null;
  detailsOpen: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  back: [];
  toggleDetails: [];
}>();

const chatStore = useChatStore();
const scrollRef = ref<HTMLElement | null>(null);
const searchText = ref('');
const pendingScrollAnchorIndex = ref<number | null>(null);
const pendingPrependHeight = ref<number | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

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

const typingLabel = computed(() => {
  if (!props.conversation) return '';
  const users = chatStore.typingUsersByConversationId[props.conversation.id] ?? [];
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].username} đang soạn tin...`;
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

const activeSearchResult = computed(() => {
  const state = currentSearchState.value;
  if (!state || state.activeResultIndex < 0) return null;
  return state.results[state.activeResultIndex] ?? null;
});

const getSenderId = (message: ChatMessage) => message.senderId ?? message.sender?.id;
const isOwnMessage = (message: ChatMessage) => getSenderId(message) === chatStore.myId;
const isActiveSearchMessage = (message: ChatMessage) => {
  return Boolean(activeSearchResult.value && message.conversationIndex === activeSearchResult.value.conversationIndex);
};

const handleScroll = () => {
  const element = scrollRef.value;
  const conversationId = props.conversation?.id;
  if (!element || !conversationId) return;

  if (element.scrollTop < 120 && currentPageInfo.value?.hasOlder) {
    const didRequest = chatStore.loadOlderMessages(conversationId);
    if (didRequest) {
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
  pendingScrollAnchorIndex.value = null;
  chatStore.navigateSearchResult(props.conversation.id, direction);
};

watch(
  () => props.conversation?.id,
  () => {
    searchText.value = '';
  },
);

watch(
  () => currentPageInfo.value?.anchorIndex,
  (anchorIndex) => {
    if (anchorIndex) pendingScrollAnchorIndex.value = anchorIndex;
  },
);

watch(
  () => sortedMessages.value.length,
  async () => {
    await nextTick();
    const element = scrollRef.value;
    if (!element) return;

    if (pendingPrependHeight.value !== null) {
      element.scrollTop = element.scrollHeight - pendingPrependHeight.value + element.scrollTop;
      pendingPrependHeight.value = null;
    }

    if (pendingScrollAnchorIndex.value !== null) {
      const target = element.querySelector<HTMLElement>(`[data-message-index="${pendingScrollAnchorIndex.value}"]`);
      target?.scrollIntoView({ block: 'center' });
      pendingScrollAnchorIndex.value = null;
    }
  },
);

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<template>
  <section class="h-full min-w-0 flex flex-col bg-surface overflow-hidden relative">
    <template v-if="props.conversation">
      <ChatHeader
        :conversation="props.conversation"
        :details-open="props.detailsOpen"
        @back="emit('back')"
        @toggle-details="emit('toggleDetails')"
      />

      <div class="px-4 sm:px-6 py-3 bg-surface-container-lowest border-b border-outline-variant">
        <div class="flex items-center gap-2">
          <div class="flex-1 min-w-0 flex items-center gap-2 rounded-full border border-outline-variant bg-surface-container-low px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
            <span class="material-symbols-outlined text-[18px] text-secondary">search</span>
            <input
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
            :disabled="!currentSearchState || currentSearchState.activeResultIndex <= 0"
            @click="navigateSearch('previous')"
          >
            <span class="material-symbols-outlined text-[20px]">keyboard_arrow_up</span>
          </button>
          <button
            class="h-9 w-9 rounded-full text-secondary hover:bg-surface-container-highest disabled:opacity-40"
            type="button"
            :disabled="!currentSearchState || currentSearchState.activeResultIndex >= currentSearchState.results.length - 1"
            @click="navigateSearch('next')"
          >
            <span class="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
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
        class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 flex flex-col gap-5 sm:gap-6 thin-scrollbar bg-background/50"
        @scroll.passive="handleScroll"
      >
        <template v-for="group in messageGroups" :key="group.key">
          <div class="flex justify-center">
            <span class="px-4 py-1 bg-tertiary-container/30 text-tertiary text-xs rounded-full font-semibold uppercase tracking-wider">
              {{ group.label }}
            </span>
          </div>

          <MessageBubble
            v-for="message in group.messages"
            :key="message.id"
            :data-message-index="message.conversationIndex"
            :class="isActiveSearchMessage(message) ? 'ring-2 ring-primary/40 rounded-2xl' : ''"
            :is-own="isOwnMessage(message)"
            :message="message"
            :status-text="isOwnMessage(message) ? chatStore.getMessageDisplayStatus(message, props.conversation) : undefined"
            @retry-media="chatStore.retryMediaMessage"
          />
        </template>
      </div>

      <div
        v-if="typingLabel"
        class="px-4 sm:px-6 py-2 bg-background/50 text-xs text-secondary flex items-center gap-2"
      >
        <span class="inline-flex gap-[2px]">
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span class="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></span>
        </span>
        <span>{{ typingLabel }}</span>
      </div>

      <ComposerBar
        @send="chatStore.sendMessage"
        @send-media="chatStore.sendMediaMessage"
        @send-gif="chatStore.sendGifMessage"
        @typing-start="props.conversation && chatStore.startTyping(props.conversation.id)"
        @typing-stop="props.conversation && chatStore.stopTyping(props.conversation.id)"
      />
    </template>

    <div v-else class="flex-1 flex flex-col items-center justify-center text-on-surface-variant bg-background/50 px-6 text-center">
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
