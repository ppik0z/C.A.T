<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import TextInput from '../atoms/TextInput.vue';
import { createGroupConversation } from '../../services/conversation.service';
import { useFriendsStore } from '../../stores/friends';
import type { Conversation } from '../../types/chat';
import type { FriendUser } from '../../types/friends';

const emit = defineEmits<{
  close: [];
  created: [conversation: Conversation];
}>();

const friendsStore = useFriendsStore();
const groupName = ref('');
const avatarGroup = ref('');
const searchTerm = ref('');
const selectedIds = ref<number[]>([]);
const selectedUsersById = ref<Record<number, FriendUser>>({});
const isSubmitting = ref(false);
const error = ref<string | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

const selectedUsers = computed(() => {
  return selectedIds.value
    .map((id) => selectedUsersById.value[id])
    .filter((user): user is FriendUser => Boolean(user));
});

const visibleUsers = computed(() => {
  const source = searchTerm.value.trim() ? friendsStore.searchResults : friendsStore.friends;
  const seen = new Set<number>();

  return source.filter((user) => {
    if (seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
});

const canSubmit = computed(() => groupName.value.trim().length > 0 && selectedIds.value.length >= 2 && !isSubmitting.value);

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
  const userId = user.id;

  if (selectedIds.value.includes(userId)) {
    selectedIds.value = selectedIds.value.filter((id) => id !== userId);
    const nextSelectedUsers = { ...selectedUsersById.value };
    delete nextSelectedUsers[userId];
    selectedUsersById.value = nextSelectedUsers;
    return;
  }

  selectedIds.value = [...selectedIds.value, userId];
  selectedUsersById.value = {
    ...selectedUsersById.value,
    [userId]: user,
  };
};

const createGroup = async () => {
  const token = localStorage.getItem('accessToken');
  if (!token || !canSubmit.value) return;

  isSubmitting.value = true;
  error.value = null;

  try {
    const conversation = await createGroupConversation(token, {
      name: groupName.value.trim(),
      avatarGroup: avatarGroup.value.trim() || null,
      memberIds: selectedIds.value,
    });
    emit('created', conversation);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Không thể tạo nhóm';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center px-4">
    <Transition appear name="modal-overlay">
      <button class="absolute inset-0 bg-black/40" type="button" aria-label="Đóng tạo nhóm" @click="emit('close')" />
    </Transition>

    <Transition appear name="modal-card">
      <section class="relative w-full max-w-lg max-h-[88dvh] overflow-hidden rounded-lg bg-surface-container-lowest shadow-xl border border-outline-variant flex flex-col">
      <header class="flex items-center justify-between gap-4 px-5 py-4 border-b border-outline-variant">
        <div>
          <h3 class="text-lg font-bold text-on-surface">Tạo nhóm chat</h3>
          <p class="text-xs font-semibold text-on-surface-variant">{{ selectedIds.length }} thành viên đã chọn</p>
        </div>
        <button class="w-10 h-10 rounded-full hover:bg-surface-container-high text-on-surface-variant" type="button" @click="emit('close')">
          <span class="material-symbols-outlined">close</span>
        </button>
      </header>

      <div class="p-5 space-y-4 overflow-y-auto thin-scrollbar">
        <TextInput v-model="groupName" placeholder="Tên nhóm" />
        <TextInput v-model="avatarGroup" placeholder="URL avatar nhóm (tuỳ chọn)" />
        <TextInput v-model="searchTerm" icon="search" placeholder="Tìm bạn bè hoặc người dùng..." />

        <div v-if="selectedUsers.length" class="flex flex-wrap gap-2">
          <button
            v-for="user in selectedUsers"
            :key="user.id"
            class="inline-flex items-center gap-2 rounded-full bg-primary-container px-2 py-1 text-xs font-semibold text-primary"
            type="button"
            @click="toggleUser(user)"
          >
            <span>{{ user.username }}</span>
            <span class="material-symbols-outlined !text-[16px]">close</span>
          </button>
        </div>

        <div v-if="error" class="rounded-lg bg-error-container px-4 py-3 text-sm font-semibold text-error">
          {{ error }}
        </div>

        <div class="space-y-1">
          <button
            v-for="user in visibleUsers"
            :key="user.id"
            class="w-full flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-container-high"
            type="button"
            @click="toggleUser(user)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <Avatar :avatar-url="user.avatar" :name="user.username" />
              <div class="min-w-0">
                <p class="font-semibold text-on-surface truncate">{{ user.username }}</p>
                <p class="text-xs text-on-surface-variant">{{ user.relationshipStatus === 'friends' ? 'Bạn bè' : 'Tìm kiếm' }}</p>
              </div>
            </div>
            <span
              :class="[
                'material-symbols-outlined',
                selectedIds.includes(user.id) ? 'text-primary' : 'text-outline',
              ]"
            >
              {{ selectedIds.includes(user.id) ? 'check_circle' : 'radio_button_unchecked' }}
            </span>
          </button>

          <div v-if="visibleUsers.length === 0" class="py-8 text-center text-sm text-on-surface-variant">
            Không tìm thấy người dùng phù hợp.
          </div>
        </div>
      </div>

      <footer class="flex items-center justify-end gap-3 px-5 py-4 border-t border-outline-variant">
        <button class="px-4 py-2 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-high" type="button" @click="emit('close')">
          Huỷ
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-on-primary disabled:opacity-50"
          :disabled="!canSubmit"
          type="button"
          @click="createGroup"
        >
          {{ isSubmitting ? 'Đang tạo...' : 'Tạo nhóm' }}
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
