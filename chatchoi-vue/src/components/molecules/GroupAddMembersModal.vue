<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import TextInput from '../atoms/TextInput.vue';
import { addConversationMembers } from '../../services/conversation.service';
import { useChatStore } from '../../stores/chat';
import { useFriendsStore } from '../../stores/friends';
import { resolveDisplayName, formatUsername } from '../../utils/userPresentation';
import type { ConversationMember } from '../../types/chat';
import type { FriendUser } from '../../types/friends';

interface Props {
  conversationId: number;
  members: ConversationMember[];
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [];
  added: [];
}>();

const chatStore = useChatStore();
const friendsStore = useFriendsStore();
const searchTerm = ref('');
const selectedIds = ref<number[]>([]);
const selectedUsersById = ref<Record<number, FriendUser>>({});
const isSubmitting = ref(false);
const error = ref<string | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const addableUsers = computed(() => {
  const existingIds = new Set(props.members.map((member) => member.userId));
  const source = [
    ...(searchTerm.value.trim() ? friendsStore.searchResults : friendsStore.friends),
    ...Object.values(selectedUsersById.value),
  ];
  const seen = new Set<number>();

  return source.filter((user) => {
    if (existingIds.has(user.id) || seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
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

const toggleUser = (user: FriendUser) => {
  error.value = null;

  if (selectedIds.value.includes(user.id)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== user.id);
    const nextSelectedUsers = { ...selectedUsersById.value };
    delete nextSelectedUsers[user.id];
    selectedUsersById.value = nextSelectedUsers;
    return;
  }

  selectedIds.value = [...selectedIds.value, user.id];
  selectedUsersById.value = {
    ...selectedUsersById.value,
    [user.id]: user,
  };
};

const submit = async () => {
  if (selectedIds.value.length === 0 || isSubmitting.value) return;

  isSubmitting.value = true;
  error.value = null;

  try {
    const updated = await addConversationMembers(props.conversationId, selectedIds.value);
    chatStore.upsertConversationDetail(updated);
    emit('added');
    emit('close');
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Không thể thêm thành viên';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="fixed inset-0 z-[110] flex items-center justify-center px-4">
    <Transition appear name="modal-overlay">
      <button class="absolute inset-0 bg-black/40" type="button" aria-label="Đóng thêm thành viên" @click="emit('close')" />
    </Transition>

    <Transition appear name="modal-card">
      <section class="relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-xl">
      <header class="flex items-center justify-between gap-4 border-b border-outline-variant px-5 py-4">
        <div>
          <h3 class="text-lg font-bold text-on-surface">Thêm thành viên</h3>
          <p class="text-xs font-semibold text-on-surface-variant">{{ selectedIds.length }} người đã chọn</p>
        </div>
        <button class="w-10 h-10 rounded-full hover:bg-surface-container-high text-on-surface-variant" type="button" @click="emit('close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 thin-scrollbar">
        <TextInput v-model="searchTerm" icon="search" placeholder="Tìm bạn bè hoặc người dùng..." />

        <div v-if="Object.values(selectedUsersById).length" class="flex flex-wrap gap-2">
          <button
            v-for="user in Object.values(selectedUsersById)"
            :key="user.id"
            class="inline-flex items-center gap-2 rounded-full bg-primary-container px-2 py-1 text-xs font-semibold text-primary"
            type="button"
            @click="toggleUser(user)"
          >
            <span>{{ resolveDisplayName(user) }}</span>
            <span class="material-symbols-outlined !text-[16px]">close</span>
          </button>
        </div>

        <div v-if="error" class="rounded-lg bg-error-container px-4 py-3 text-sm font-semibold text-error">
          {{ error }}
        </div>

        <div class="space-y-1">
          <button
            v-for="user in addableUsers"
            :key="user.id"
            class="w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-container-high"
            type="button"
            @click="toggleUser(user)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <Avatar :avatar-url="user.avatar" :name="user.username" />
              <div class="min-w-0">
                <p class="font-semibold text-on-surface truncate">{{ resolveDisplayName(user) }}</p>
                <p v-if="user.username" class="text-xs text-on-surface-variant/70 truncate">{{ formatUsername(user.username) }}</p>
                <p class="text-xs text-on-surface-variant">{{ user.relationshipStatus === 'friends' ? 'Bạn bè' : 'Tìm kiếm' }}</p>
              </div>
            </div>
            <span :class="['material-symbols-outlined', selectedIds.includes(user.id) ? 'text-primary' : 'text-outline']">
              {{ selectedIds.includes(user.id) ? 'check_circle' : 'radio_button_unchecked' }}
            </span>
          </button>

          <div v-if="addableUsers.length === 0" class="py-8 text-center text-sm text-on-surface-variant">
            Không tìm thấy người dùng phù hợp.
          </div>
        </div>
      </div>

      <footer class="flex items-center justify-end gap-3 border-t border-outline-variant px-5 py-4">
        <button class="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high" type="button" @click="emit('close')">
          Huỷ
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary disabled:opacity-50"
          :disabled="selectedIds.length === 0 || isSubmitting"
          type="button"
          @click="submit"
        >
          {{ isSubmitting ? 'Đang thêm...' : `Thêm ${selectedIds.length} thành viên` }}
        </button>
      </footer>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.modal-overlay-enter-active,
.modal-overlay-leave-active {
  transition: opacity 150ms ease;
}

.modal-overlay-enter-from,
.modal-overlay-leave-to {
  opacity: 0;
}

.modal-card-enter-active,
.modal-card-leave-active {
  transition:
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 150ms ease;
}

.modal-card-enter-from,
.modal-card-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
</style>
