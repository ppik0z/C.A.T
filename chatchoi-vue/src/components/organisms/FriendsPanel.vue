<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import TextInput from '../atoms/TextInput.vue';
import FriendRow from '../molecules/FriendRow.vue';
import { useChatStore } from '../../stores/chat';
import { useFriendsStore } from '../../stores/friends';
import { accessDirectConversation, fetchConversations } from '../../services/conversation.service';
import type { FriendsTab } from '../../types/friends';

const emit = defineEmits<{
  openMessages: [];
}>();

const friendsStore = useFriendsStore();
const chatStore = useChatStore();
const searchTerm = ref('');
const activeTab = ref<FriendsTab>('suggestions');
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const tabs: Array<{ value: FriendsTab; label: string }> = [
  { value: 'suggestions', label: 'Suggestions' },
  { value: 'requests', label: 'Requests' },
  { value: 'friends', label: 'All friends' },
];

const visibleUsers = computed(() => {
  if (searchTerm.value.trim()) return friendsStore.searchResults;
  if (activeTab.value === 'friends') return friendsStore.friends;
  if (activeTab.value === 'requests') return [...friendsStore.incomingRequests, ...friendsStore.outgoingRequests];
  return friendsStore.suggestions;
});

const emptyLabel = computed(() => {
  if (searchTerm.value.trim()) return 'Không tìm thấy người dùng phù hợp.';
  if (activeTab.value === 'friends') return 'Chưa có bạn bè nào.';
  if (activeTab.value === 'requests') return 'Không có lời mời đang chờ.';
  return 'Chưa có gợi ý phù hợp.';
});

watch(searchTerm, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void friendsStore.search(value);
  }, 250);
});

onMounted(() => {
  if (!friendsStore.hasLoaded) {
    void friendsStore.refreshAll();
  }
});

const handleMessage = async (friendId: number) => {
  const token = localStorage.getItem('accessToken');
  if (!token) return;

  const conversation = await accessDirectConversation(token, friendId);
  const conversations = await fetchConversations(token);
  chatStore.setConversations(conversations);
  chatStore.selectConversation(conversation.id);
  emit('openMessages');
};
</script>

<template>
  <section class="h-full min-w-0 flex flex-col bg-surface-container-lowest">
    <div class="p-4 sm:p-6 border-b border-outline-variant">
      <div class="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 class="text-2xl sm:text-[32px] sm:leading-10 font-bold text-primary">Friends</h2>
          <p class="text-sm font-semibold text-on-surface-variant">
            {{ friendsStore.friends.length }} friends · {{ friendsStore.pendingCount }} pending
          </p>
        </div>

        <button
          class="h-10 w-10 rounded-xl bg-surface-container-high text-on-surface-variant flex items-center justify-center"
          title="Refresh"
          type="button"
          @click="friendsStore.refreshAll"
        >
          <span class="material-symbols-outlined !text-[22px]">refresh</span>
        </button>
      </div>

      <TextInput v-model="searchTerm" class="mb-4" icon="search" placeholder="Search people..." />

      <div class="flex gap-2 overflow-x-auto thin-scrollbar pb-1">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="[
            'px-4 py-1 rounded-full text-xs font-semibold transition-colors whitespace-nowrap',
            activeTab === tab.value
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-surface-container-high text-on-surface-variant hover:bg-outline-variant/20',
          ]"
          type="button"
          @click="activeTab = tab.value"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1fr)_320px]">
      <div class="min-h-0 overflow-y-auto thin-scrollbar border-r border-outline-variant/70">
        <div v-if="friendsStore.error" class="m-4 rounded-lg bg-error-container px-4 py-3 text-sm font-semibold text-error">
          {{ friendsStore.error }}
        </div>

        <div v-if="friendsStore.isLoading" class="px-6 py-12 text-center text-sm text-on-surface-variant">
          Đang tải danh sách bạn bè...
        </div>

        <template v-else>
          <FriendRow
            v-for="user in visibleUsers"
            :key="`${user.relationshipStatus}-${user.id}`"
            :user="user"
            @accept="friendsStore.acceptRequest"
            @add="friendsStore.sendRequest"
            @cancel="friendsStore.cancelRequest"
            @message="handleMessage"
            @reject="friendsStore.rejectRequest"
            @remove="friendsStore.removeFriend"
          />

          <div v-if="visibleUsers.length === 0" class="px-6 py-12 text-center text-sm text-on-surface-variant">
            {{ emptyLabel }}
          </div>
        </template>
      </div>

      <aside class="hidden lg:flex flex-col gap-4 p-5 bg-surface-container-low">
        <div class="rounded-lg bg-surface-container-lowest border border-outline-variant p-4">
          <h3 class="font-bold text-on-surface mb-3">Requests</h3>
          <div class="flex items-center justify-between text-sm font-semibold text-on-surface-variant">
            <span>Incoming</span>
            <span>{{ friendsStore.incomingRequests.length }}</span>
          </div>
          <div class="flex items-center justify-between text-sm font-semibold text-on-surface-variant mt-2">
            <span>Outgoing</span>
            <span>{{ friendsStore.outgoingRequests.length }}</span>
          </div>
        </div>

        <div class="rounded-lg bg-surface-container-lowest border border-outline-variant p-4">
          <h3 class="font-bold text-on-surface mb-3">Online friends</h3>
          <div class="text-3xl font-bold text-primary">
            {{ friendsStore.friends.filter((friend) => friend.isOnline).length }}
          </div>
          <p class="text-sm font-semibold text-on-surface-variant">active now</p>
        </div>
      </aside>
    </div>
  </section>
</template>
