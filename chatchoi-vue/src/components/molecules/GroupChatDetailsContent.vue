<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import TextInput from '../atoms/TextInput.vue';
import type { Conversation, ConversationMember } from '../../types/chat';
import type { FriendUser } from '../../types/friends';
import { addConversationMembers, removeConversationMember, updateConversation } from '../../services/conversation.service';
import { useChatStore } from '../../stores/chat';
import { useFriendsStore } from '../../stores/friends';
import { getConversationName } from '../../utils/chatPresentation';

interface Props {
  conversation: Conversation;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
});

const chatStore = useChatStore();
const friendsStore = useFriendsStore();
const isEditingGroup = ref(false);
const isAddingMembers = ref(false);
const editName = ref('');
const editAvatar = ref('');
const memberSearch = ref('');
const addSearch = ref('');
const selectedAddIds = ref<number[]>([]);
const error = ref<string | null>(null);
let addSearchTimer: ReturnType<typeof setTimeout> | null = null;

const detail = computed(() => chatStore.conversationDetailsById[props.conversation.id] ?? props.conversation);
const isLoadingDetail = computed(() => chatStore.conversationDetailLoadStateById[props.conversation.id] === 'loading');
const isAdmin = computed(() => Boolean(detail.value.myMember?.isAdmin));
const members = computed(() => detail.value.members ?? []);
const filteredMembers = computed(() => {
  const query = memberSearch.value.trim().toLowerCase();
  if (!query) return members.value;
  return members.value.filter((member) => member.username.toLowerCase().includes(query));
});

const addableUsers = computed(() => {
  const existingIds = new Set(members.value.map((member) => member.userId));
  const source = addSearch.value.trim() ? friendsStore.searchResults : friendsStore.friends;
  const seen = new Set<number>();

  return source.filter((user) => {
    if (existingIds.has(user.id) || seen.has(user.id)) return false;
    seen.add(user.id);
    return true;
  });
});

const token = () => localStorage.getItem('accessToken');

const resetForms = () => {
  error.value = null;
  isEditingGroup.value = false;
  isAddingMembers.value = false;
  selectedAddIds.value = [];
  memberSearch.value = '';
  addSearch.value = '';
};

const refreshDetail = async (force = false) => {
  error.value = null;
  try {
    await chatStore.loadConversationDetail(props.conversation.id, force);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Không thể tải thông tin nhóm';
  }
};

watch(addSearch, (value) => {
  if (addSearchTimer) clearTimeout(addSearchTimer);
  addSearchTimer = setTimeout(() => {
    void friendsStore.search(value);
  }, 250);
});

watch(
  () => props.conversation.id,
  () => {
    resetForms();
    void refreshDetail();
  },
  { immediate: true },
);

onMounted(() => {
  if (!friendsStore.hasLoaded) {
    void friendsStore.refreshAll();
  }
});

const startEdit = () => {
  editName.value = detail.value.name ?? '';
  editAvatar.value = detail.value.avatarGroup ?? '';
  isEditingGroup.value = true;
  error.value = null;
};

const saveGroup = async () => {
  const accessToken = token();
  if (!accessToken) return;

  try {
    const updated = await updateConversation(accessToken, props.conversation.id, {
      name: editName.value.trim(),
      avatarGroup: editAvatar.value.trim() || null,
    });
    chatStore.upsertConversationDetail(updated);
    isEditingGroup.value = false;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Không thể cập nhật nhóm';
  }
};

const toggleAddUser = (user: FriendUser) => {
  if (selectedAddIds.value.includes(user.id)) {
    selectedAddIds.value = selectedAddIds.value.filter((id) => id !== user.id);
    return;
  }

  selectedAddIds.value = [...selectedAddIds.value, user.id];
};

const addMembers = async () => {
  const accessToken = token();
  if (!accessToken || selectedAddIds.value.length === 0) return;

  try {
    const updated = await addConversationMembers(accessToken, props.conversation.id, selectedAddIds.value);
    chatStore.upsertConversationDetail(updated);
    selectedAddIds.value = [];
    addSearch.value = '';
    isAddingMembers.value = false;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Không thể thêm thành viên';
  }
};

const removeMember = async (member: ConversationMember) => {
  const accessToken = token();
  if (!accessToken) return;

  const isSelf = member.userId === chatStore.myId;
  const confirmed = window.confirm(isSelf ? 'Rời khỏi nhóm này?' : `Xoá ${member.username} khỏi nhóm?`);
  if (!confirmed) return;

  try {
    await removeConversationMember(accessToken, props.conversation.id, member.userId);
    if (isSelf) {
      chatStore.removeConversation(props.conversation.id);
      return;
    }
    chatStore.invalidateConversationDetail(props.conversation.id);
    await refreshDetail(true);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Không thể cập nhật thành viên';
  }
};
</script>

<template>
  <div class="w-full">
    <div :class="['border-b border-outline-variant bg-surface-container-low/50', props.compact ? 'p-4' : 'p-6']">
      <div class="flex flex-col items-center">
        <Avatar
          :avatar-url="detail.avatarGroup"
          :name="getConversationName(detail)"
          :class="props.compact ? 'mb-2' : 'mb-4'"
          :size="props.compact ? 'lg' : 'xl'"
        />
        <h3 :class="['font-bold text-on-surface text-center', props.compact ? 'text-lg' : 'text-xl']">{{ getConversationName(detail) }}</h3>
        <p class="text-sm font-semibold text-secondary mt-1">{{ members.length || detail.memberCount || 0 }} members</p>
        <p class="text-xs font-semibold uppercase text-on-surface-variant mt-2">{{ isAdmin ? 'Admin' : 'Member' }}</p>
      </div>

      <div v-if="error" class="mt-4 rounded-lg bg-error-container px-4 py-3 text-sm font-semibold text-error">
        {{ error }}
      </div>

      <div v-if="isAdmin" class="mt-5 space-y-3">
        <template v-if="isEditingGroup">
          <TextInput v-model="editName" placeholder="Tên nhóm" />
          <TextInput v-model="editAvatar" placeholder="URL avatar nhóm" />
          <div class="flex gap-2">
            <button class="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary" type="button" @click="saveGroup">Lưu</button>
            <button class="flex-1 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold text-on-surface-variant" type="button" @click="isEditingGroup = false">Huỷ</button>
          </div>
        </template>
        <button v-else class="w-full flex items-center justify-center gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold text-primary" type="button" @click="startEdit">
          <span class="material-symbols-outlined !text-[18px]">edit</span>
          Chỉnh sửa nhóm
        </button>
      </div>
    </div>

    <div :class="['border-b border-outline-variant', props.compact ? 'p-4' : 'p-6']">
      <div class="flex items-center justify-between gap-3 mb-3">
        <h4 class="font-semibold text-on-surface">Members</h4>
        <button v-if="isAdmin" class="text-xs font-semibold text-primary" type="button" @click="isAddingMembers = !isAddingMembers">
          {{ isAddingMembers ? 'Close' : 'Add' }}
        </button>
      </div>

      <div v-if="isAddingMembers" class="mb-4 space-y-3">
        <TextInput v-model="addSearch" icon="search" placeholder="Tìm người để thêm..." />
        <div class="max-h-52 overflow-y-auto thin-scrollbar space-y-1">
          <button
            v-for="user in addableUsers"
            :key="user.id"
            class="w-full flex items-center justify-between rounded-lg px-2 py-2 hover:bg-surface-container-high text-left"
            type="button"
            @click="toggleAddUser(user)"
          >
            <span class="font-semibold text-sm text-on-surface truncate">{{ user.username }}</span>
            <span :class="['material-symbols-outlined', selectedAddIds.includes(user.id) ? 'text-primary' : 'text-outline']">
              {{ selectedAddIds.includes(user.id) ? 'check_circle' : 'radio_button_unchecked' }}
            </span>
          </button>
        </div>
        <button class="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50" :disabled="selectedAddIds.length === 0" type="button" @click="addMembers">
          Thêm {{ selectedAddIds.length }} thành viên
        </button>
      </div>

      <TextInput v-model="memberSearch" class="mb-3" icon="search" placeholder="Tìm trong nhóm..." />

      <div v-if="isLoadingDetail" class="py-6 text-center text-sm text-on-surface-variant">Đang tải thành viên...</div>
      <div v-else class="space-y-1">
        <div
          v-for="member in filteredMembers"
          :key="member.userId"
          class="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface-container-high"
        >
          <div class="flex items-center gap-3 min-w-0">
            <Avatar :avatar-url="member.avatar" :is-online="member.isOnline" :name="member.username" show-status />
            <div class="min-w-0">
              <p class="font-semibold text-on-surface truncate">{{ member.username }}</p>
              <p class="text-xs text-on-surface-variant">
                {{ member.isAdmin ? 'Admin' : 'Member' }} · {{ member.isOnline ? 'Online' : 'Offline' }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span v-if="member.isAdmin" class="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase text-primary">Admin</span>
            <button
              v-if="member.userId === chatStore.myId || (isAdmin && !member.isAdmin)"
              class="w-9 h-9 rounded-full text-error hover:bg-error-container/30"
              :title="member.userId === chatStore.myId ? 'Rời nhóm' : 'Xoá khỏi nhóm'"
              type="button"
              @click="removeMember(member)"
            >
              <span class="material-symbols-outlined !text-[20px]">{{ member.userId === chatStore.myId ? 'logout' : 'person_remove' }}</span>
            </button>
          </div>
        </div>

        <div v-if="filteredMembers.length === 0" class="py-6 text-center text-sm text-on-surface-variant">
          Không tìm thấy thành viên.
        </div>
      </div>
    </div>

    <div :class="props.compact ? 'p-4' : 'p-6'">
      <h4 :class="['font-semibold text-on-surface', props.compact ? 'mb-3' : 'mb-4']">Group Settings</h4>
      <button class="w-full flex items-center gap-4 p-2 rounded-xl hover:bg-surface-container-high transition-colors text-on-surface-variant text-left" type="button">
        <span class="material-symbols-outlined">notifications</span>
        <span class="text-base">Notifications</span>
      </button>
      <button
        v-if="detail.myMember"
        class="w-full flex items-center gap-4 p-2 rounded-xl hover:bg-error-container/20 text-error transition-colors mt-3 text-left"
        type="button"
        @click="removeMember({ id: 0, userId: detail.myMember.userId, username: 'Bạn', nickname: null, avatar: null, isAdmin, isOnline: true, joinedAt: '' })"
      >
        <span class="material-symbols-outlined">logout</span>
        <span class="text-base font-semibold">Rời nhóm</span>
      </button>
    </div>
  </div>
</template>
