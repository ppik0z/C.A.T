<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import PreferenceRow from '@/components/molecules/PreferenceRow.vue';
import { useAccountStore } from '@/stores/account';
import { resolveDisplayName, formatUsername } from '@/utils/userPresentation';
import ProfileCardContent from '@/components/molecules/ProfileCardContent.vue';
import { useAuthStore } from '@/stores/auth';

const accountStore = useAccountStore();
const authStore = useAuthStore();

const isEditing = ref(false);
const draftProfile = ref({
  displayName: '',
  bio: '',
  customStatus: '',
});
const fileInput = ref<HTMLInputElement | null>(null);
const isUploading = ref(false);

const displayName = computed(() => resolveDisplayName(accountStore.me));

onMounted(async () => {
  await accountStore.fetchAccount();
  syncDrafts();
});

const syncDrafts = () => {
  draftProfile.value = {
    displayName: accountStore.me?.displayName || '',
    bio: accountStore.me?.bio || '',
    customStatus: accountStore.me?.customStatus || '',
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
      <CardContent class="overflow-hidden p-0">
        <ProfileCardContent
          :avatar-url="accountStore.me?.avatar"
          :banner="accountStore.me?.banner"
          :bio="isEditing ? draftProfile.bio : accountStore.me?.bio"
          :custom-status="isEditing ? draftProfile.customStatus : accountStore.me?.customStatus"
          eyebrow="Giới thiệu"
          :is-online="accountStore.me?.presence === 'online'"
          :name="isEditing ? (draftProfile.displayName || accountStore.me?.username || 'User') : displayName"
          :status-label="accountStore.me?.presence === 'online' ? 'Online' : 'Offline'"
          :username="formatUsername(accountStore.me?.username)"
        />
        <div class="px-4 pb-4">
          <button class="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold text-primary hover:bg-primary-container/30" type="button" @click="triggerFileInput">
            {{ isUploading ? 'Đang tải ảnh...' : 'Đổi ảnh đại diện' }}
          </button>
          <input ref="fileInput" class="hidden" type="file" accept="image/*" @change="handleFileChange" />
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
            <span class="font-semibold text-on-surface line-clamp-2 max-w-[200px] text-right">{{ accountStore.me?.bio || 'Chưa cập nhật' }}</span>
          </PreferenceRow>
          <Separator />
          <PreferenceRow icon="lock" :title="$t('settings.account.password.title')" :description="$t('settings.account.password.description')">
            <Button disabled type="button" variant="outline">{{ $t('settings.account.password.action') }}</Button>
          </PreferenceRow>
          <Separator />
          <PreferenceRow icon="logout" :title="$t('settings.account.logout.title')" :description="$t('settings.account.logout.description')">
            <Button type="button" variant="destructive" @click="authStore.logout()">{{ $t('settings.account.logout.action') }}</Button>
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
              <Button :disabled="accountStore.isSaving" @click="handleSave">{{ accountStore.isSaving ? 'Đang lưu...' : 'Lưu thay đổi' }}</Button>
            </div>
          </div>
        </template>
        <p v-if="accountStore.error" class="mt-4 rounded-lg bg-error-container px-3 py-2 text-sm font-semibold text-error">
          {{ accountStore.error }}
        </p>
      </CardContent>
    </Card>
  </div>
</template>
