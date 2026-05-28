<script setup lang="ts">
import { computed, ref } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import PreferenceRow from '@/components/molecules/PreferenceRow.vue';
import SettingOptionButton from '@/components/molecules/SettingOptionButton.vue';
import SettingsTabItem from '@/components/molecules/SettingsTabItem.vue';
import ThemePreview from '@/components/molecules/ThemePreview.vue';
import { useChatStore } from '@/stores/chat';
import { themePresets, type ThemePresetId } from '@/theme/themePresets';
import { useThemePreference } from '@/theme/themePreference';
import type {
  FontChoice,
  MessageDensity,
  SettingOption,
  SettingsTab,
  SettingsTabId,
} from '@/types/settings';

type LanguageChoice = 'vi' | 'en';
type TimeFormat = '24h' | '12h';
type StartupView = 'messages' | 'friends';
type SidebarMode = 'hover' | 'icons';
type NotificationLevel = 'all' | 'mentions' | 'muted';
type MessageRequestPolicy = 'everyone' | 'friends' | 'none';

const chatStore = useChatStore();
const { activePreset, activePresetId, setThemePreset } = useThemePreference();

const settingsTabs: SettingsTab[] = [
  { id: 'appearance', icon: 'palette', label: 'Appearance', summary: 'Theme, font, chat density' },
  { id: 'language', icon: 'translate', label: 'Language & Region', summary: 'Ngôn ngữ, thời gian' },
  { id: 'general', icon: 'tune', label: 'General', summary: 'Điều hướng, media' },
  { id: 'privacy', icon: 'shield_lock', label: 'Privacy', summary: 'Trạng thái, quyền riêng tư' },
  { id: 'account', icon: 'account_circle', label: 'Account', summary: 'Hồ sơ, bảo mật' },
  { id: 'notifications', icon: 'notifications', label: 'Notifications', summary: 'Âm báo, preview' },
];

const fontOptions: Array<SettingOption<FontChoice>> = [
  { value: 'jakarta', label: 'Plus Jakarta', description: 'Gọn, hiện đại' },
  { value: 'lexend', label: 'Lexend', description: 'Rõ chữ, dễ đọc' },
  { value: 'system', label: 'System', description: 'Nhanh nhất' },
];

const densityOptions: Array<SettingOption<MessageDensity>> = [
  { value: 'comfortable', label: 'Comfortable', description: 'Khoảng thở rộng' },
  { value: 'compact', label: 'Compact', description: 'Hiển thị nhiều hơn' },
];

const activeTab = ref<SettingsTabId>('appearance');
const isMobileDetailOpen = ref(false);
const fontChoice = ref<FontChoice>('jakarta');
const messageDensity = ref<MessageDensity>('comfortable');
const language = ref<LanguageChoice>('vi');
const timeFormat = ref<TimeFormat>('24h');
const startupView = ref<StartupView>('messages');
const sidebarMode = ref<SidebarMode>('hover');
const autoplayMedia = ref(false);
const reduceMotion = ref(false);
const activeStatusVisible = ref(true);
const readReceipts = ref(true);
const profileVisible = ref(true);
const messageRequestPolicy = ref<MessageRequestPolicy>('friends');
const messagePreview = ref(true);
const notificationSound = ref(true);
const quietHours = ref(false);
const notificationLevel = ref<NotificationLevel>('mentions');

const activeTabMeta = computed(() => settingsTabs.find((tab) => tab.id === activeTab.value) ?? settingsTabs[0]);
const userName = computed(() => chatStore.myUserName ?? 'User');
const userInitial = computed(() => userName.value[0]?.toUpperCase() ?? 'U');

const selectTab = (tabId: SettingsTabId) => {
  activeTab.value = tabId;
  isMobileDetailOpen.value = true;
};

const closeMobileDetail = () => {
  isMobileDetailOpen.value = false;
};

const handleThemePresetSelected = (presetId: ThemePresetId) => {
  setThemePreset(presetId);
};
</script>

<template>
  <section class="h-full min-w-0 bg-surface-container-lowest text-on-surface">
    <div class="flex h-full min-w-0">
      <aside
        :class="[
          isMobileDetailOpen ? 'hidden md:flex' : 'flex',
          'min-w-0 flex-1 flex-col border-outline-variant bg-surface md:w-[320px] md:flex-none md:border-r',
        ]"
      >
        <div class="border-b border-outline-variant p-5">
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Chatchoi</p>
          <h2 class="mt-1 text-2xl font-extrabold leading-8 text-primary">Settings</h2>
          <div class="mt-4 flex items-center gap-3 rounded-lg bg-surface-container-lowest p-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-sm font-extrabold text-on-secondary-container">
              {{ userInitial }}
            </div>
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-on-surface">{{ userName }}</p>
              <p class="truncate text-xs font-semibold text-success">Online</p>
            </div>
          </div>
        </div>

        <nav class="min-h-0 flex-1 space-y-1 overflow-y-auto p-3 thin-scrollbar" aria-label="Settings sections">
          <SettingsTabItem
            v-for="tab in settingsTabs"
            :key="tab.id"
            :active="activeTab === tab.id"
            :icon="tab.icon"
            :label="tab.label"
            :summary="tab.summary"
            @select="selectTab(tab.id)"
          />
        </nav>
      </aside>

      <main
        :class="[
          isMobileDetailOpen ? 'flex' : 'hidden md:flex',
          'min-w-0 flex-1 flex-col bg-surface-container-lowest',
        ]"
      >
        <header class="flex min-h-16 items-center gap-3 border-b border-outline-variant px-4 sm:px-6">
          <Button class="md:hidden" size="icon" type="button" variant="ghost" @click="closeMobileDetail">
            <span class="material-symbols-outlined !text-[22px]">arrow_back</span>
          </Button>
          <div class="min-w-0">
            <h1 class="truncate text-xl font-extrabold leading-7 text-on-surface">{{ activeTabMeta.label }}</h1>
            <p class="truncate text-sm font-semibold text-on-surface-variant">{{ activeTabMeta.summary }}</p>
          </div>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-4 thin-scrollbar sm:p-6">
          <Transition mode="out-in" name="settings-fade">
            <div :key="activeTab" class="mx-auto max-w-5xl space-y-4">
              <template v-if="activeTab === 'appearance'">
                <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <div class="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Theme</CardTitle>
                        <CardDescription>Chọn preset màu cho toàn bộ giao diện chat.</CardDescription>
                      </CardHeader>
                      <CardContent class="space-y-4">
                        <div class="grid gap-3 sm:grid-cols-2">
                          <button
                            v-for="preset in themePresets"
                            :key="preset.id"
                            :aria-pressed="activePresetId === preset.id"
                            :class="[
                              'rounded-lg border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]',
                              activePresetId === preset.id
                                ? 'border-primary bg-primary-container/30 shadow-sm'
                                : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low',
                            ]"
                            type="button"
                            @click="handleThemePresetSelected(preset.id)"
                          >
                            <div class="mb-3 flex gap-1">
                              <span class="h-8 flex-1 rounded-md" :style="{ backgroundColor: preset.colors.primary }" />
                              <span class="h-8 flex-1 rounded-md" :style="{ backgroundColor: preset.colors.surfaceContainerLow }" />
                              <span class="h-8 flex-1 rounded-md" :style="{ backgroundColor: preset.colors.surfaceContainerHighest }" />
                            </div>
                            <span class="block text-sm font-extrabold text-on-surface">{{ preset.name }}</span>
                            <span class="mt-1 block text-xs font-semibold leading-4 text-on-surface-variant">{{ preset.description }}</span>
                          </button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Typography & density</CardTitle>
                        <CardDescription>Tối ưu cảm giác đọc và số lượng tin nhắn trên màn hình.</CardDescription>
                      </CardHeader>
                      <CardContent class="space-y-4">
                        <div class="grid gap-2 sm:grid-cols-3">
                          <SettingOptionButton
                            v-for="option in fontOptions"
                            :key="option.value"
                            :description="option.description"
                            :label="option.label"
                            :selected="fontChoice === option.value"
                            @select="fontChoice = option.value"
                          />
                        </div>

                        <Separator />

                        <div class="grid gap-2 sm:grid-cols-2">
                          <SettingOptionButton
                            v-for="option in densityOptions"
                            :key="option.value"
                            :description="option.description"
                            :label="option.label"
                            :selected="messageDensity === option.value"
                            @select="messageDensity = option.value"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card class="xl:sticky xl:top-0 xl:self-start">
                    <CardHeader>
                      <CardTitle>Live preview</CardTitle>
                      <CardDescription>Áp dụng lựa chọn trên mẫu hội thoại.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ThemePreview
                        :density="messageDensity"
                        :font="fontChoice"
                        :preset="activePreset"
                      />
                    </CardContent>
                  </Card>
                </div>
              </template>

              <template v-else-if="activeTab === 'language'">
                <Card>
                  <CardHeader>
                    <CardTitle>Language & Region</CardTitle>
                    <CardDescription>Thiết lập ngôn ngữ và định dạng thời gian hiển thị.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PreferenceRow icon="language" title="App language" description="Ngôn ngữ chính cho giao diện.">
                      <select
                        v-model="language"
                        class="h-10 min-w-40 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="vi">Tiếng Việt</option>
                        <option value="en">English</option>
                      </select>
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="schedule" title="Time format" description="Định dạng giờ trong danh sách chat và tin nhắn.">
                      <div class="grid grid-cols-2 gap-2">
                        <Button :variant="timeFormat === '24h' ? 'secondary' : 'outline'" type="button" @click="timeFormat = '24h'">
                          24h
                        </Button>
                        <Button :variant="timeFormat === '12h' ? 'secondary' : 'outline'" type="button" @click="timeFormat = '12h'">
                          12h
                        </Button>
                      </div>
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="event" title="Date preview" description="Mẫu hiển thị ngày trong trạng thái hiện tại.">
                      <span class="rounded-lg bg-surface-container-high px-3 py-2 text-sm font-bold text-on-surface">
                        {{ language === 'vi' ? 'Thứ năm, 28/05/2026' : 'Thu, May 28, 2026' }}
                      </span>
                    </PreferenceRow>
                  </CardContent>
                </Card>
              </template>

              <template v-else-if="activeTab === 'general'">
                <Card>
                  <CardHeader>
                    <CardTitle>General</CardTitle>
                    <CardDescription>Các tuỳ chọn mặc định khi mở ứng dụng.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PreferenceRow icon="home" title="Startup view" description="Màn hình đầu tiên sau khi đăng nhập.">
                      <div class="grid grid-cols-2 gap-2">
                        <Button :variant="startupView === 'messages' ? 'secondary' : 'outline'" type="button" @click="startupView = 'messages'">
                          Messages
                        </Button>
                        <Button :variant="startupView === 'friends' ? 'secondary' : 'outline'" type="button" @click="startupView = 'friends'">
                          Friends
                        </Button>
                      </div>
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="dock_to_left" title="Sidebar style" description="Cách thanh điều hướng desktop mở rộng.">
                      <div class="grid grid-cols-2 gap-2">
                        <Button :variant="sidebarMode === 'hover' ? 'secondary' : 'outline'" type="button" @click="sidebarMode = 'hover'">
                          Hover
                        </Button>
                        <Button :variant="sidebarMode === 'icons' ? 'secondary' : 'outline'" type="button" @click="sidebarMode = 'icons'">
                          Icons
                        </Button>
                      </div>
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="animated_images" title="Autoplay media" description="Tự chạy GIF và video preview trong cuộc trò chuyện.">
                      <Switch v-model:checked="autoplayMedia" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="motion_photos_off" title="Reduce motion" description="Giảm chuyển động ở các vùng giao diện phụ.">
                      <Switch v-model:checked="reduceMotion" />
                    </PreferenceRow>
                  </CardContent>
                </Card>
              </template>

              <template v-else-if="activeTab === 'privacy'">
                <Card>
                  <CardHeader>
                    <CardTitle>Privacy</CardTitle>
                    <CardDescription>Kiểm soát trạng thái và thông tin hiển thị với người khác.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PreferenceRow icon="radio_button_checked" title="Active status" description="Cho bạn bè thấy khi tài khoản đang online.">
                      <Switch v-model:checked="activeStatusVisible" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="done_all" title="Read receipts" description="Hiển thị trạng thái đã xem trong đoạn chat.">
                      <Switch v-model:checked="readReceipts" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="badge" title="Profile visibility" description="Cho phép người khác xem hồ sơ rút gọn.">
                      <Switch v-model:checked="profileVisible" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="mark_chat_unread" title="Message requests" description="Ai có thể gửi tin nhắn mới tới tài khoản này.">
                      <select
                        v-model="messageRequestPolicy"
                        class="h-10 min-w-44 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="everyone">Everyone</option>
                        <option value="friends">Friends only</option>
                        <option value="none">No one</option>
                      </select>
                    </PreferenceRow>
                  </CardContent>
                </Card>
              </template>

              <template v-else-if="activeTab === 'account'">
                <div class="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <Card>
                    <CardContent class="pt-5">
                      <div class="flex flex-col items-center text-center">
                        <div class="flex size-20 items-center justify-center rounded-lg bg-secondary-container text-2xl font-extrabold text-on-secondary-container">
                          {{ userInitial }}
                        </div>
                        <h3 class="mt-4 max-w-full truncate text-lg font-extrabold text-on-surface">{{ userName }}</h3>
                        <p class="text-sm font-semibold text-on-surface-variant">Chatchoi account</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Account</CardTitle>
                      <CardDescription>Thông tin hồ sơ và bảo mật tài khoản.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PreferenceRow icon="person" title="Display name" description="Tên hiển thị trong cuộc trò chuyện.">
                        <Button disabled type="button" variant="outline">Edit</Button>
                      </PreferenceRow>
                      <Separator />
                      <PreferenceRow icon="lock" title="Password" description="Cập nhật mật khẩu và bảo vệ đăng nhập.">
                        <Button disabled type="button" variant="outline">Change</Button>
                      </PreferenceRow>
                      <Separator />
                      <PreferenceRow icon="devices" title="Sessions" description="Quản lý thiết bị đang đăng nhập.">
                        <Button disabled type="button" variant="outline">Review</Button>
                      </PreferenceRow>
                      <Separator />
                      <PreferenceRow icon="logout" title="Logout" description="Thoát phiên đăng nhập trên thiết bị này.">
                        <Button disabled type="button" variant="destructive">Logout</Button>
                      </PreferenceRow>
                    </CardContent>
                  </Card>
                </div>
              </template>

              <template v-else>
                <Card>
                  <CardHeader>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Điều chỉnh mức độ thông báo cho tin nhắn mới.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PreferenceRow icon="chat_bubble" title="Message preview" description="Hiển thị nội dung rút gọn trong thông báo.">
                      <Switch v-model:checked="messagePreview" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="volume_up" title="Sound" description="Phát âm báo khi có tin nhắn mới.">
                      <Switch v-model:checked="notificationSound" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="notifications_active" title="Notification level" description="Mức ưu tiên thông báo trong các đoạn chat.">
                      <select
                        v-model="notificationLevel"
                        class="h-10 min-w-40 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="all">All messages</option>
                        <option value="mentions">Mentions</option>
                        <option value="muted">Muted</option>
                      </select>
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="bedtime" title="Quiet hours" description="Tạm dừng âm báo trong khoảng thời gian nghỉ.">
                      <Switch v-model:checked="quietHours" />
                    </PreferenceRow>
                  </CardContent>
                </Card>
              </template>
            </div>
          </Transition>
        </div>
      </main>
    </div>
  </section>
</template>

<style scoped>
.settings-fade-enter-active,
.settings-fade-leave-active {
  transition: opacity 140ms ease, transform 140ms ease;
}

.settings-fade-enter-from,
.settings-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
