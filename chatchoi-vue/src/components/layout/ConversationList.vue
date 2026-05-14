<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useChatStore } from '../../stores/chat';
import type { Conversation } from '../../types/chat';
import { fetchConversations } from '../../services/conversation.service';

type ConversationFilter = 'all' | 'unread' | 'groups';

interface FilterOption {
  value: ConversationFilter;
  label: string;
}

const chatStore = useChatStore();
const searchTerm = ref('');
const activeFilter = ref<ConversationFilter>('all');

const filterOptions: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'groups', label: 'Groups' },
];

const getConversationName = (conversation: Conversation) => {
  return conversation.isGroup
    ? conversation.name ?? `Nhóm #${conversation.id}`
    : conversation.friend?.username ?? `Chat #${conversation.id}`;
};

const getConversationInitials = (conversation: Conversation) => {
  return getConversationName(conversation)
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

const getLastMessagePreview = (conversation: Conversation) => {
  if (conversation.lastMessage?.content) {
    const sender = conversation.lastMessage.senderName === chatStore.myUserName ? 'Bạn' : conversation.lastMessage.senderName;
    return sender ? `${sender}: ${conversation.lastMessage.content}` : conversation.lastMessage.content;
  }

  return conversation.lastMessageContent ?? 'Chưa có tin nhắn nào...';
};

const conversations = computed(() => {
  const normalizedSearch = searchTerm.value.trim().toLowerCase();

  return chatStore.conversations
    .filter((conversation) => {
      if (activeFilter.value === 'unread') return conversation.unreadCount > 0;
      if (activeFilter.value === 'groups') return conversation.isGroup;
      return true;
    })
    .filter((conversation) => getConversationName(conversation).toLowerCase().includes(normalizedSearch));
});

onMounted(async () => {
  const token = localStorage.getItem('accessToken');
  if (!token) return;

  try {
    const data = await fetchConversations(token);
    chatStore.setConversations(data);
    await chatStore.prefetchMessagesForConversations(data.slice(0, 3).map((conversation) => conversation.id));
  } catch (error) {
    console.error('Lỗi lấy danh sách phòng:', error);
  }
});

const handleSelectConv = (convId: number) => {
  chatStore.selectConversation(convId);
};
</script>

<template>
  <section class="w-[320px] md:w-[360px] h-full flex flex-col border-r border-outline-variant bg-surface-container-lowest shrink-0">
    <div class="p-6">
      <h2 class="text-[32px] leading-10 font-bold text-primary mb-4">Messages</h2>

      <div class="relative mb-6">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
        <input
          v-model="searchTerm"
          class="w-full pl-11 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-base"
          placeholder="Search conversations..."
          type="text"
        />
      </div>

      <div class="flex gap-2">
        <button
          v-for="filter in filterOptions"
          :key="filter.value"
          :class="[
            'px-4 py-1 rounded-full text-xs font-semibold transition-colors',
            activeFilter === filter.value
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-high text-on-surface-variant hover:bg-outline-variant/20',
          ]"
          type="button"
          @click="activeFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto thin-scrollbar">
      <button
        v-for="conv in conversations"
        :key="conv.id"
        :class="[
          'w-full px-6 py-4 flex gap-4 text-left cursor-pointer transition-colors border-r-4',
          chatStore.currentConversationId === conv.id
            ? 'bg-primary-container/35 border-primary'
            : 'border-transparent hover:bg-surface-container-high',
        ]"
        type="button"
        @click="handleSelectConv(conv.id)"
      >
        <div class="relative shrink-0">
          <div class="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold border-2 border-white shadow-sm overflow-hidden">
            <img
              v-if="!conv.isGroup && conv.friend?.avatar"
              :alt="getConversationName(conv)"
              :src="conv.friend.avatar"
              class="w-full h-full object-cover"
            />
            <span v-else>{{ getConversationInitials(conv) }}</span>
          </div>
          <span
            v-if="conv.isOnline"
            class="absolute bottom-0 right-0 w-3.5 h-3.5 bg-secondary border-2 border-white rounded-full animate-pulse"
          />
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex justify-between items-baseline gap-3">
            <h3 class="font-semibold text-on-surface truncate">{{ getConversationName(conv) }}</h3>
            <span v-if="conv.unreadCount > 0" class="text-xs text-secondary shrink-0">{{ conv.unreadCount }} new</span>
          </div>
          <p
            :class="[
              'text-sm truncate mt-1',
              conv.unreadCount > 0 ? 'text-primary font-semibold' : 'text-on-surface-variant',
            ]"
          >
            {{ getLastMessagePreview(conv) }}
          </p>
        </div>
      </button>
    </div>
  </section>
</template>
