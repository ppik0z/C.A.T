<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import TextInput from '../atoms/TextInput.vue';
import ConversationItem from '../molecules/ConversationItem.vue';
import { useChatStore } from '../../stores/chat';
import { fetchConversations } from '../../services/conversation.service';
import { getConversationName } from '../../utils/chatPresentation';

type ConversationFilter = 'all' | 'unread' | 'groups';

interface FilterOption {
  value: ConversationFilter;
  label: string;
}

const emit = defineEmits<{
  selected: [];
}>();

const chatStore = useChatStore();
const searchTerm = ref('');
const activeFilter = ref<ConversationFilter>('all');

const filterOptions: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'groups', label: 'Groups' },
];

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

const handleSelect = (conversationId: number) => {
  chatStore.selectConversation(conversationId);
  emit('selected');
};
</script>

<template>
  <section class="h-full min-w-0 flex flex-col border-r border-outline-variant bg-surface-container-lowest">
    <div class="p-4 sm:p-6">
      <h2 class="text-2xl sm:text-[32px] sm:leading-10 font-bold text-primary mb-4">Messages</h2>

      <TextInput v-model="searchTerm" class="mb-4 sm:mb-6" icon="search" placeholder="Search conversations..." />

      <div class="flex gap-2 overflow-x-auto thin-scrollbar pb-1">
        <button
          v-for="filter in filterOptions"
          :key="filter.value"
          :class="[
            'px-4 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap',
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
      <ConversationItem
        v-for="conversation in conversations"
        :key="conversation.id"
        :active="chatStore.currentConversationId === conversation.id"
        :conversation="conversation"
        :current-username="chatStore.myUserName"
        @select="handleSelect"
      />

      <div v-if="conversations.length === 0" class="px-6 py-12 text-center text-sm text-on-surface-variant">
        Không tìm thấy đoạn chat phù hợp.
      </div>
    </div>
  </section>
</template>
