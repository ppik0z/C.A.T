<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Avatar from '../atoms/Avatar.vue';
import ConversationMuteControl from './ConversationMuteControl.vue';
import GroupAddMembersModal from './GroupAddMembersModal.vue';
import GroupAvatarPicker from './GroupAvatarPicker.vue';
import MemberHoverCard from './MemberHoverCard.vue';
import TextInput from '../atoms/TextInput.vue';
import type { Conversation, ConversationMember } from '../../types/chat';
import {
  removeConversationMember,
  updateConversation,
} from '../../services/conversation.service';
import { useChatStore } from '../../stores/chat';
import { getConversationName } from '../../utils/chatPresentation';
import { resolveDisplayName, formatUsername } from '../../utils/userPresentation';

interface Props {
  conversation: Conversation;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
});

const emit = defineEmits<{
  openMessageSearch: [];
}>();

const chatStore = useChatStore();
const isEditingGroup = ref(false);
const isAddingMembers = ref(false);
const editName = ref('');
const editDescription = ref('');
const editAvatarFile = ref<File | null>(null);
const isSavingGroup = ref(false);
const memberSearch = ref('');
const error = ref<string | null>(null);

const detail = computed(() => chatStore.conversationDetailsById[props.conversation.id] ?? props.conversation);
const isLoadingDetail = computed(() => chatStore.conversationDetailLoadStateById[props.conversation.id] === 'loading');
const isAdmin = computed(() => Boolean(detail.value.myMember?.isAdmin));
const members = computed(() => detail.value.members ?? []);
const filteredMembers = computed(() => {
  const query = memberSearch.value.trim().toLowerCase();
  if (!query) return members.value;
  return members.value.filter((member) => 
    member.username.toLowerCase().includes(query) ||
    (member.displayName?.toLowerCase().includes(query) ?? false)
  );
});

const resetForms = () => {
  error.value = null;
  isEditingGroup.value = false;
  isAddingMembers.value = false;
  memberSearch.value = '';
};

const refreshDetail = async (force = false) => {
  error.value = null;
  try {
    await chatStore.loadConversationDetail(props.conversation.id, force);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Không thể tải thông tin nhóm';
  }
};

watch(
  () => props.conversation.id,
  () => {
    resetForms();
    void refreshDetail();
  },
  { immediate: true },
);

const startEdit = () => {
  editName.value = detail.value.name ?? '';
  editDescription.value = detail.value.description ?? '';
  editAvatarFile.value = null;
  isEditingGroup.value = true;
  error.value = null;
};

const saveGroup = async () => {
  if (!editName.value.trim() || isSavingGroup.value) return;
  isSavingGroup.value = true;
  error.value = null;
  try {
    const updated = await updateConversation(props.conversation.id, {
      name: editName.value.trim(),
      description: editDescription.value.trim() || null,
      avatar: editAvatarFile.value,
    });
    chatStore.upsertConversationDetail(updated);
    isEditingGroup.value = false;
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Không thể cập nhật nhóm';
  } finally {
    isSavingGroup.value = false;
  }
};

const removeMember = async (member: ConversationMember) => {
  const isSelf = member.userId === chatStore.myId;
  const confirmed = window.confirm(isSelf ? 'Rời khỏi nhóm này?' : `Xoá ${resolveDisplayName(member)} khỏi nhóm?`);
  if (!confirmed) return;

  try {
    await removeConversationMember(props.conversation.id, member.userId);
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
        <p v-if="detail.description" class="mt-2 max-w-xs text-center text-sm font-medium leading-5 text-on-surface-variant">
          {{ detail.description }}
        </p>
        <p class="mt-2 text-sm font-semibold text-secondary">{{ members.length || detail.memberCount || 0 }} thành viên</p>
        <p class="mt-2 text-xs font-semibold uppercase text-on-surface-variant">{{ isAdmin ? 'Quản trị viên' : 'Thành viên' }}</p>
      </div>

      <div v-if="error" class="mt-4 rounded-lg bg-error-container px-4 py-3 text-sm font-semibold text-error">
        {{ error }}
      </div>

      <button
        class="mt-5 w-full flex items-center justify-center gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-on-primary transition-colors"
        type="button"
        @click="emit('openMessageSearch')"
      >
        <span class="material-symbols-outlined !text-[18px]">search</span>
        Tìm tin nhắn
      </button>

      <div v-if="isAdmin" class="mt-5 space-y-3">
        <template v-if="isEditingGroup">
          <div class="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
            <GroupAvatarPicker
              v-model="editAvatarFile"
              :disabled="isSavingGroup"
              :existing-url="detail.avatarGroup"
              :name="editName"
            />
          </div>
          <TextInput v-model="editName" placeholder="Tên nhóm" />
          <textarea
            v-model="editDescription"
            class="min-h-24 w-full resize-none rounded-xl border border-transparent bg-surface-container-low px-4 py-3 text-sm font-medium text-on-surface outline-none transition placeholder:text-outline focus:border-primary focus:ring-2 focus:ring-primary/20"
            maxlength="500"
            placeholder="Mô tả nhóm"
          ></textarea>
          <div class="flex gap-2">
            <button
              class="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
              :disabled="!editName.trim() || isSavingGroup"
              type="button"
              @click="saveGroup"
            >
              {{ isSavingGroup ? 'Đang lưu...' : 'Lưu' }}
            </button>
            <button
              class="flex-1 rounded-lg bg-surface-container-high px-3 py-2 text-sm font-semibold text-on-surface-variant disabled:opacity-50"
              :disabled="isSavingGroup"
              type="button"
              @click="isEditingGroup = false"
            >
              Huỷ
            </button>
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
        <button v-if="isAdmin" class="text-xs font-semibold text-primary" type="button" @click="isAddingMembers = true">
          Add
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
            <MemberHoverCard :member="member">
              <Avatar :avatar-url="member.avatar" :is-online="member.isOnline" :name="member.username" show-status />
            </MemberHoverCard>
            <div class="min-w-0">
              <p class="font-semibold text-on-surface truncate">{{ resolveDisplayName(member) }}</p>
              <p v-if="member.username" class="text-xs text-on-surface-variant/70 truncate">{{ formatUsername(member.username) }}</p>
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
      <ConversationMuteControl :conversation="props.conversation" />
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

    <GroupAddMembersModal
      v-if="isAddingMembers"
      :conversation-id="props.conversation.id"
      :members="members"
      @added="refreshDetail(true)"
      @close="isAddingMembers = false"
    />
  </div>
</template>
