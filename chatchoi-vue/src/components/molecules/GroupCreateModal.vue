<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CheckCircle2, Circle, LoaderCircle, Users, X } from '@lucide/vue';
import Avatar from '../atoms/Avatar.vue';
import TextInput from '../atoms/TextInput.vue';
import GroupAvatarPicker from './GroupAvatarPicker.vue';
import LoadingListSkeleton from './LoadingListSkeleton.vue';
import { createGroupConversation } from '../../services/conversation.service';
import { useFriendsStore } from '../../stores/friends';
import { resolveDisplayName, formatUsername } from '../../utils/userPresentation';
import type { Conversation } from '../../types/chat';
import type { FriendUser } from '../../types/friends';

const emit = defineEmits<{
  close: [];
  created: [conversation: Conversation];
}>();

const friendsStore = useFriendsStore();
const groupName = ref('');
const groupDescription = ref('');
const avatarFile = ref<File | null>(null);
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

const canSubmit = computed(() => {
  const nameLength = groupName.value.trim().length;
  return nameLength > 0
    && nameLength <= 100
    && groupDescription.value.trim().length <= 500
    && selectedIds.value.length >= 2
    && !isSubmitting.value;
});
const isUserListLoading = computed(() => (
  searchTerm.value.trim()
    ? friendsStore.isSearching
    : friendsStore.isLoading && !friendsStore.hasLoaded
));

watch(searchTerm, (value) => {
  if (searchTimer) clearTimeout(searchTimer);
  if (!value.trim()) {
    void friendsStore.search('');
    return;
  }
  searchTimer = setTimeout(() => {
    void friendsStore.search(value);
  }, 250);
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
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
  if (!canSubmit.value) return;

  isSubmitting.value = true;
  error.value = null;

  try {
    const conversation = await createGroupConversation({
      name: groupName.value.trim(),
      description: groupDescription.value.trim() || null,
      avatar: avatarFile.value,
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
  <div class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5">
    <Transition appear name="modal-overlay">
      <button class="absolute inset-0 bg-black/50 backdrop-blur-[2px]" type="button" aria-label="Đóng tạo nhóm" @click="emit('close')" />
    </Transition>

    <Transition appear name="modal-card">
      <section class="relative flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] border border-outline-variant bg-surface-container-lowest shadow-2xl">
      <header class="flex items-center justify-between gap-4 border-b border-outline-variant px-5 py-4 sm:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-container text-primary">
            <Users class="h-5 w-5" aria-hidden="true" />
          </span>
          <div class="min-w-0">
            <h3 class="truncate text-lg font-extrabold text-on-surface">Tạo nhóm chat</h3>
            <p class="truncate text-xs font-semibold text-on-surface-variant">
              Thêm thông tin và chọn ít nhất 2 thành viên
            </p>
          </div>
        </div>
        <button class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" type="button" aria-label="Đóng" @click="emit('close')">
          <X class="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 thin-scrollbar sm:p-6">
        <section class="rounded-2xl border border-outline-variant bg-surface-container-low/55 p-4 sm:p-5">
          <GroupAvatarPicker
            v-model="avatarFile"
            :disabled="isSubmitting"
            :name="groupName"
          />

          <div class="mt-5 space-y-4">
            <label class="block">
              <span class="mb-1.5 block text-sm font-bold text-on-surface">Tên nhóm <span class="text-error">*</span></span>
              <TextInput v-model="groupName" :maxlength="100" placeholder="Ví dụ: Team cuối tuần" />
              <span class="mt-1 block text-right text-xs font-medium text-on-surface-variant">{{ groupName.length }}/100</span>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-sm font-bold text-on-surface">Mô tả nhóm</span>
              <textarea
                v-model="groupDescription"
                class="min-h-24 w-full resize-none rounded-xl border border-transparent bg-surface-container-low px-4 py-3 text-sm font-medium text-on-surface outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20"
                maxlength="500"
                placeholder="Nhóm này dùng để trao đổi về điều gì?"
              ></textarea>
              <span class="mt-1 block text-right text-xs font-medium text-on-surface-variant">{{ groupDescription.length }}/500</span>
            </label>
          </div>
        </section>

        <section>
          <div class="mb-3 flex items-center justify-between gap-3">
            <div>
              <h4 class="text-base font-extrabold text-on-surface">Thành viên</h4>
              <p class="text-xs font-medium text-on-surface-variant">Có thể tìm cả người chưa kết bạn</p>
            </div>
            <span class="rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-primary">
              {{ selectedIds.length }} đã chọn
            </span>
          </div>

          <div class="relative">
            <TextInput v-model="searchTerm" icon="search" placeholder="Tìm theo tên hoặc username..." />
            <LoaderCircle
              v-if="friendsStore.isSearching"
              class="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-primary"
              aria-label="Đang tìm kiếm"
            />
          </div>

          <div v-if="selectedUsers.length" class="mt-3 flex gap-2 overflow-x-auto pb-1 thin-scrollbar">
            <button
              v-for="user in selectedUsers"
              :key="user.id"
              class="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary-container py-1 pl-1 pr-2 text-xs font-bold text-primary transition hover:bg-primary-container/75"
              type="button"
              :aria-label="`Bỏ chọn ${resolveDisplayName(user)}`"
              @click="toggleUser(user)"
            >
              <Avatar :avatar-url="user.avatar" :name="user.username" size="sm" />
              <span class="max-w-28 truncate">{{ resolveDisplayName(user) }}</span>
              <X class="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div v-if="error || (searchTerm.trim() && friendsStore.searchError)" class="mt-3 rounded-xl bg-error-container px-4 py-3 text-sm font-semibold text-error" role="alert">
            {{ error || friendsStore.searchError }}
          </div>

          <div class="mt-3 min-h-48 rounded-2xl border border-outline-variant p-1">
            <LoadingListSkeleton v-if="isUserListLoading" :rows="4" />
            <template v-else>
              <button
                v-for="user in visibleUsers"
                :key="user.id"
                :class="[
                  'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  selectedIds.includes(user.id) ? 'bg-primary-container/55' : 'hover:bg-surface-container-high',
                ]"
                type="button"
                :aria-pressed="selectedIds.includes(user.id)"
                @click="toggleUser(user)"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <Avatar :avatar-url="user.avatar" :name="user.username" />
                  <div class="min-w-0">
                    <p class="truncate font-bold text-on-surface">{{ resolveDisplayName(user) }}</p>
                    <p v-if="user.username" class="truncate text-xs text-on-surface-variant/70">{{ formatUsername(user.username) }}</p>
                    <p class="text-xs font-medium text-on-surface-variant">{{ user.relationshipStatus === 'friends' ? 'Bạn bè' : 'Người dùng ChatChoi' }}</p>
                  </div>
                </div>
                <CheckCircle2 v-if="selectedIds.includes(user.id)" class="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <Circle v-else class="h-5 w-5 shrink-0 text-outline" aria-hidden="true" />
              </button>

              <div v-if="visibleUsers.length === 0" class="flex min-h-44 flex-col items-center justify-center px-5 text-center">
                <Users class="mb-2 h-8 w-8 text-outline" aria-hidden="true" />
                <p class="text-sm font-semibold text-on-surface">Không tìm thấy người dùng</p>
                <p class="mt-1 text-xs text-on-surface-variant">Thử tìm bằng tên hiển thị hoặc username khác.</p>
              </div>
            </template>
          </div>
        </section>
      </div>

      <footer class="flex items-center justify-between gap-3 border-t border-outline-variant bg-surface-container-lowest px-4 py-4 sm:px-6">
        <p class="hidden text-xs font-semibold text-on-surface-variant sm:block">
          Bạn sẽ là quản trị viên của nhóm
        </p>
        <div class="ml-auto flex items-center gap-2">
        <button class="h-10 rounded-full px-4 text-sm font-bold text-on-surface-variant transition hover:bg-surface-container-high" type="button" @click="emit('close')">
          Huỷ
        </button>
        <button
          class="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-on-primary shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!canSubmit"
          type="button"
          @click="createGroup"
        >
          <LoaderCircle v-if="isSubmitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
          {{ isSubmitting ? 'Đang tạo...' : 'Tạo nhóm' }}
        </button>
        </div>
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
