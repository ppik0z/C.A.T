<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import PreferenceRow from '@/components/molecules/PreferenceRow.vue';
import { useAccountStore } from '@/stores/account';
import { useChatStore } from '@/stores/chat';
import { useI18n } from 'vue-i18n';

const accountStore = useAccountStore();
const chatStore = useChatStore();
const { t } = useI18n();

const isEditing = ref(false);
const draftProfile = ref({
  displayName: '',
  bio: '',
  customStatus: '',
});
const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);

const userName = computed(() => chatStore.myUserName ?? 'User');
const userInitial = computed(() => userName.value[0]?.toUpperCase() ?? 'U');
const userAvatar = computed(() => chatStore.myAvatar || null);
const displayName = computed(() => accountStore.profile?.displayName || userName.value);

onMounted(async () => {
  await accountStore.fetchAccount();
  syncDrafts();
});

const syncDrafts = () => {
  draftProfile.value = {
    displayName: accountStore.profile?.displayName || '',
    bio: accountStore.profile?.bio || '',
    customStatus: accountStore.profile?.customStatus || '',
  };
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isUploading.value = true;
  try {
    await accountStore.updateAvatar(file);
    // Tạm thời lấy lại chatStore info nếu cần, API updateAvatar nên refresh auth
  } catch (err) {
    console.error(err);
  } finally {
    isUploading.value = false;
  }
};

const handleSave = async () => {
  try {
    await accountStore.updateProfile(draftProfile.value);
    isEditing.value = false;
  } catch (error) {
    console.error('Failed to save profile', error);
  }
};
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
    <!-- Profile Preview Card -->
    <Card>
      <CardContent class="pt-5">
        <div class="flex flex-col items-center text-center">
          <div class="relative group cursor-pointer" @click="triggerFileInput">
            <img v-if="userAvatar" :src="userAvatar" class="size-24 rounded-lg object-cover" />
            <div v-else class="flex size-24 items-center justify-center rounded-lg bg-secondary-container text-3xl font-extrabold text-on-secondary-container">
              {{ userInitial }}
            </div>
            <!-- Overlay for hover -->
            <div class="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span class="material-symbols-outlined text-white !text-2xl">edit</span>
            </div>
            <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileChange" />
          </div>
          
          <h3 class="mt-4 max-w-full truncate text-lg font-extrabold text-on-surface">
            {{ isEditing ? draftProfile.displayName : displayName }}
          </h3>
          <p class="text-sm font-semibold text-on-surface-variant">
            {{ isEditing ? draftProfile.customStatus : (accountStore.profile?.customStatus || 'Online') }}
          </p>
          <p class="mt-4 text-sm text-on-surface text-left w-full border-t border-outline-variant pt-4" v-if="isEditing ? draftProfile.bio : accountStore.profile?.bio">
            <span class="block font-bold text-xs uppercase mb-1 text-on-surface-variant">Giới thiệu</span>
            {{ isEditing ? draftProfile.bio : accountStore.profile?.bio }}
          </p>
        </div>
      </CardContent>
    </Card>

    <!-- Settings Card -->
    <Card>
      <CardHeader class="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{{ $t('settings.account.title') }}</CardTitle>
          <CardDescription>{{ $t('settings.account.description') }}</CardDescription>
        </div>
        <Button v-if="!isEditing" @click="isEditing = true" variant="outline">Chỉnh sửa hồ sơ</Button>
      </CardHeader>
      <CardContent>
        <template v-if="!isEditing">
          <PreferenceRow icon="person" :title="$t('settings.account.displayName.title')" :description="$t('settings.account.displayName.description')">
            <span class="font-semibold text-on-surface">{{ displayName }}</span>
          </PreferenceRow>
          <Separator />
          <PreferenceRow icon="info" title="Giới thiệu bản thân" description="Một đoạn ngắn mô tả về bạn.">
            <span class="font-semibold text-on-surface line-clamp-2 max-w-[200px] text-right">{{ accountStore.profile?.bio || 'Chưa cập nhật' }}</span>
          </PreferenceRow>
          <Separator />
          <PreferenceRow icon="lock" :title="$t('settings.account.password.title')" :description="$t('settings.account.password.description')">
            <Button disabled type="button" variant="outline">{{ $t('settings.account.password.action') }}</Button>
          </PreferenceRow>
          <Separator />
          <PreferenceRow icon="logout" :title="$t('settings.account.logout.title')" :description="$t('settings.account.logout.description')">
            <Button disabled type="button" variant="destructive">{{ $t('settings.account.logout.action') }}</Button>
          </PreferenceRow>
        </template>
        
        <template v-else>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-bold text-on-surface mb-1">Tên hiển thị</label>
              <input v-model="draftProfile.displayName" class="w-full h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm focus:ring-2 focus:ring-primary" placeholder="Tên hiển thị..." />
            </div>
            <div>
              <label class="block text-sm font-bold text-on-surface mb-1">Trạng thái tuỳ chỉnh</label>
              <input v-model="draftProfile.customStatus" class="w-full h-10 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm focus:ring-2 focus:ring-primary" placeholder="Đang code..." />
            </div>
            <div>
              <label class="block text-sm font-bold text-on-surface mb-1">Giới thiệu bản thân</label>
              <textarea v-model="draftProfile.bio" class="w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-sm focus:ring-2 focus:ring-primary" rows="3" placeholder="Đôi nét về bạn..."></textarea>
            </div>
            <div class="flex justify-end gap-2 pt-4">
              <Button variant="ghost" @click="isEditing = false; syncDrafts()">Hủy</Button>
              <Button @click="handleSave">Lưu thay đổi</Button>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
