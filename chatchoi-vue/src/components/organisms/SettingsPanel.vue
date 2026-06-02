<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import PreferenceRow from '@/components/molecules/PreferenceRow.vue';
import SettingOptionButton from '@/components/molecules/SettingOptionButton.vue';
import SettingsTabItem from '@/components/molecules/SettingsTabItem.vue';
import ThemePreview from '@/components/molecules/ThemePreview.vue';
import AccountTab from '@/components/organisms/AccountTab.vue';
import { useChatStore } from '@/stores/chat';
import { resolveDisplayName } from '@/utils/userPresentation';
import { themePresets, type ThemePresetId, resolveThemePreset } from '@/theme/themePresets';
import { useAppearance } from '@/theme/useAppearance';
import { useLocalization } from '@/i18n/useLocalization';
import { useFormatDate } from '@/composables/useFormatDate';
import { useI18n } from 'vue-i18n';
import type {
  FontChoice,
  FontSize,
  LanguageChoice,
  MessageDensity,
  SettingOption,
  SettingsTab,
  SettingsTabId,
  TimeFormat,
} from '@/types/settings';
import { useAccountStore } from '@/stores/account';
import Avatar from '@/components/atoms/Avatar.vue';
import { usePushNotificationsStore } from '@/stores/push-notifications';

type StartupView = 'messages' | 'friends';
type SidebarMode = 'hover' | 'icons';
type MessageRequestPolicy = 'everyone' | 'friends' | 'none';

const chatStore = useChatStore();
const accountStore = useAccountStore();
const pushNotificationsStore = usePushNotificationsStore();
const { activePresetId, activeFont, activeFontSize, activeDensity, commitAppearance } = useAppearance();
const { activeLanguage, activeTimeFormat, activeTimezone, commitLocalization } = useLocalization();

const supportedTimezones = Intl.supportedValuesOf('timeZone');


const { t } = useI18n();

const settingsTabs = computed<SettingsTab[]>(() => [
  { id: 'appearance', icon: 'palette', label: t('settings.tabs.appearance.label'), summary: t('settings.tabs.appearance.summary') },
  { id: 'language', icon: 'translate', label: t('settings.tabs.language.label'), summary: t('settings.tabs.language.summary') },
  { id: 'general', icon: 'tune', label: t('settings.tabs.general.label'), summary: t('settings.tabs.general.summary') },
  { id: 'privacy', icon: 'shield_lock', label: t('settings.tabs.privacy.label'), summary: t('settings.tabs.privacy.summary') },
  { id: 'account', icon: 'account_circle', label: t('settings.tabs.account.label'), summary: t('settings.tabs.account.summary') },
  { id: 'notifications', icon: 'notifications', label: t('settings.tabs.notifications.label'), summary: t('settings.tabs.notifications.summary') },
]);

const fontOptions = computed<Array<SettingOption<FontChoice>>>(() => [
  { value: 'jakarta', label: t('settings.appearance.typography.fontOptions.jakarta.label'), description: t('settings.appearance.typography.fontOptions.jakarta.description') },
  { value: 'lexend', label: t('settings.appearance.typography.fontOptions.lexend.label'), description: t('settings.appearance.typography.fontOptions.lexend.description') },
  { value: 'inter', label: t('settings.appearance.typography.fontOptions.inter.label'), description: t('settings.appearance.typography.fontOptions.inter.description') },
  { value: 'roboto', label: t('settings.appearance.typography.fontOptions.roboto.label'), description: t('settings.appearance.typography.fontOptions.roboto.description') },
  { value: 'opensans', label: t('settings.appearance.typography.fontOptions.opensans.label'), description: t('settings.appearance.typography.fontOptions.opensans.description') },
  { value: 'system', label: t('settings.appearance.typography.fontOptions.system.label'), description: t('settings.appearance.typography.fontOptions.system.description') },
]);

const fontSizeOptions = computed<Array<SettingOption<FontSize>>>(() => [
  { value: 'small', label: t('settings.appearance.typography.sizeOptions.small.label'), description: t('settings.appearance.typography.sizeOptions.small.description') },
  { value: 'medium', label: t('settings.appearance.typography.sizeOptions.medium.label'), description: t('settings.appearance.typography.sizeOptions.medium.description') },
  { value: 'large', label: t('settings.appearance.typography.sizeOptions.large.label'), description: t('settings.appearance.typography.sizeOptions.large.description') },
  { value: 'extra-large', label: t('settings.appearance.typography.sizeOptions.extraLarge.label'), description: t('settings.appearance.typography.sizeOptions.extraLarge.description') },
]);

// densityOptions temporarily removed as it's not used

const props = defineProps<{
  initialTab?: SettingsTabId;
}>();

const activeTab = ref<SettingsTabId>(props.initialTab ?? 'appearance');

watch(() => props.initialTab, (newVal) => {
  if (newVal) {
    activeTab.value = newVal;
  }
});
const isMobileDetailOpen = ref(false);

// Draft states for Appearance
const draftPresetId = ref<ThemePresetId>(activePresetId.value);
const draftFont = ref<FontChoice>(activeFont.value);
const draftFontSize = ref<FontSize>(activeFontSize.value);
const draftDensity = ref<MessageDensity>(activeDensity.value);

// Draft states for Localization
const draftLanguage = ref<LanguageChoice>(activeLanguage.value);
const draftTimeFormat = ref<TimeFormat>(activeTimeFormat.value);
const draftTimezone = ref<string>(activeTimezone.value);

const now = new Date();
const datePreview = useFormatDate(now, draftLanguage, draftTimeFormat, draftTimezone);

const syncDrafts = () => {
  draftPresetId.value = activePresetId.value;
  draftFont.value = activeFont.value;
  draftFontSize.value = activeFontSize.value;
  draftDensity.value = activeDensity.value;
  
  draftLanguage.value = activeLanguage.value;
  draftTimeFormat.value = activeTimeFormat.value;
  draftTimezone.value = activeTimezone.value;
};

// Discard drafts when switching tabs
watch(activeTab, (_, oldTab) => {
  if (oldTab === 'appearance' || oldTab === 'language') {
    syncDrafts();
  }
});

const isDirty = computed(() => {
  return draftPresetId.value !== activePresetId.value ||
         draftFont.value !== activeFont.value ||
         draftFontSize.value !== activeFontSize.value ||
         draftDensity.value !== activeDensity.value ||
         draftLanguage.value !== activeLanguage.value ||
         draftTimeFormat.value !== activeTimeFormat.value ||
         draftTimezone.value !== activeTimezone.value;
});

const draftPreset = computed(() => resolveThemePreset(draftPresetId.value));

const applyChanges = () => {
  commitAppearance(draftPresetId.value, draftFont.value, draftFontSize.value, draftDensity.value);
  commitLocalization(draftLanguage.value, draftTimeFormat.value, draftTimezone.value);
};

// Other settings
const startupView = ref<StartupView>('messages');
const sidebarMode = ref<SidebarMode>('hover');
const autoplayMedia = ref(false);
const reduceMotion = ref(false);
const activeStatusVisible = ref(true);
const readReceipts = ref(true);
const profileVisible = ref(true);
const messageRequestPolicy = ref<MessageRequestPolicy>('friends');
const messagePreview = computed({
  get: () => accountStore.settings?.showNotificationPreview ?? true,
  set: (value: boolean) => void accountStore.updateSettings({ showNotificationPreview: value }),
});
const notificationSound = computed({
  get: () => accountStore.settings?.notificationSound ?? true,
  set: (value: boolean) => void accountStore.updateSettings({ notificationSound: value }),
});

const activeTabMeta = computed(() => settingsTabs.value.find((tab: SettingsTab) => tab.id === activeTab.value) ?? settingsTabs.value[0]);
const userName = computed(() => resolveDisplayName(accountStore.me ?? { displayName: chatStore.myDisplayName, username: chatStore.myUserName }));

const selectTab = (tabId: SettingsTabId) => {
  activeTab.value = tabId;
  isMobileDetailOpen.value = true;
};

const closeMobileDetail = () => {
  isMobileDetailOpen.value = false;
};

const togglePushNotifications = (enabled: boolean) => {
  void (enabled ? pushNotificationsStore.enable() : pushNotificationsStore.disable()).catch(() => undefined);
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
          <p class="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">{{ $t('settings.header.appTitle') }}</p>
          <h2 class="mt-1 text-2xl font-extrabold leading-8 text-primary">{{ $t('settings.header.title') }}</h2>
          <div class="mt-4 flex items-center gap-3 rounded-lg bg-surface-container-lowest p-3">
            <Avatar :avatar-url="accountStore.me?.avatar" :name="userName" />
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-on-surface">{{ userName }}</p>
              <p class="truncate text-xs font-semibold text-success">{{ $t('settings.header.online') }}</p>
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
                        <CardTitle>{{ $t('settings.appearance.theme.title') }}</CardTitle>
                        <CardDescription>{{ $t('settings.appearance.theme.description') }}</CardDescription>
                      </CardHeader>
                      <CardContent class="space-y-4">
                        <div class="grid gap-3 sm:grid-cols-2">
                          <button
                            v-for="preset in themePresets"
                            :key="preset.id"
                            :aria-pressed="draftPresetId === preset.id"
                            :class="[
                              'rounded-lg border p-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.99]',
                              draftPresetId === preset.id
                                ? 'border-primary bg-primary-container/30 shadow-sm'
                                : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low',
                            ]"
                            type="button"
                            @click="draftPresetId = preset.id"
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
                        <CardTitle>{{ $t('settings.appearance.typography.title') }}</CardTitle>
                        <CardDescription>{{ $t('settings.appearance.typography.description') }}</CardDescription>
                      </CardHeader>
                      <CardContent class="space-y-4">
                        <div class="grid gap-2 sm:grid-cols-3">
                          <SettingOptionButton
                            v-for="option in fontOptions"
                            :key="option.value"
                            :description="option.description"
                            :label="option.label"
                            :selected="draftFont === option.value"
                            @select="draftFont = option.value"
                          />
                        </div>

                        <Separator />

                        <div class="space-y-3">
                          <p class="text-sm font-bold text-on-surface">{{ $t('settings.appearance.typography.size') }}</p>
                          <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <SettingOptionButton
                              v-for="option in fontSizeOptions"
                              :key="option.value"
                              :description="option.description"
                              :label="option.label"
                              :selected="draftFontSize === option.value"
                              @select="draftFontSize = option.value"
                            />
                          </div>
                        </div>

                        <!-- Temporarily hiding density
                        <Separator />

                        <div class="grid gap-2 sm:grid-cols-2">
                          <SettingOptionButton
                            v-for="option in densityOptions"
                            :key="option.value"
                            :description="option.description"
                            :label="option.label"
                            :selected="draftDensity === option.value"
                            @select="draftDensity = option.value"
                          />
                        </div>
                        -->
                      </CardContent>
                    </Card>
                  </div>

                  <Card class="xl:sticky xl:top-0 xl:self-start">
                    <CardHeader>
                      <CardTitle>{{ $t('settings.appearance.livePreview.title') }}</CardTitle>
                      <CardDescription>{{ $t('settings.appearance.livePreview.description') }}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ThemePreview
                        :density="draftDensity"
                        :font="draftFont"
                        :fontSize="draftFontSize"
                        :preset="draftPreset"
                      />
                    </CardContent>
                  </Card>
                </div>
                  <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="translate-y-4 opacity-0"
                    enter-to-class="translate-y-0 opacity-100"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="translate-y-0 opacity-100"
                    leave-to-class="translate-y-4 opacity-0"
                  >
                    <div v-if="isDirty" class="sticky bottom-4 z-10 mx-auto mt-4 max-w-fit rounded-xl border border-outline-variant bg-surface-container p-3 shadow-lg flex items-center gap-4">
                      <span class="text-sm font-semibold text-on-surface">{{ $t('settings.common.youHaveUnsavedChanges') }}</span>
                      <div class="flex items-center gap-2">
                        <Button variant="ghost" @click="syncDrafts">{{ $t('settings.common.reset') }}</Button>
                        <Button @click="applyChanges">{{ $t('settings.common.applyChanges') }}</Button>
                      </div>
                    </div>
                  </Transition>
              </template>

              <template v-else-if="activeTab === 'language'">
                <div class="space-y-4 relative">
                  <Card>
                    <CardHeader>
                      <CardTitle>{{ $t('settings.languageRegion.title') }}</CardTitle>
                      <CardDescription>{{ $t('settings.languageRegion.description') }}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <PreferenceRow icon="language" :title="$t('settings.languageRegion.appLanguage.title')" :description="$t('settings.languageRegion.appLanguage.description')">
                        <select
                          v-model="draftLanguage"
                          class="h-10 min-w-40 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="vi">{{ $t('settings.languageRegion.appLanguage.vi') }}</option>
                          <option value="en">{{ $t('settings.languageRegion.appLanguage.en') }}</option>
                        </select>
                      </PreferenceRow>
                      <Separator />
                      <PreferenceRow icon="public" :title="$t('settings.languageRegion.timezone.title')" :description="$t('settings.languageRegion.timezone.description')">
                        <select
                          v-model="draftTimezone"
                          class="h-10 max-w-[200px] rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option v-for="tz in supportedTimezones" :key="tz" :value="tz">{{ tz }}</option>
                        </select>
                      </PreferenceRow>
                      <Separator />
                      <PreferenceRow icon="schedule" :title="$t('settings.languageRegion.timeFormat.title')" :description="$t('settings.languageRegion.timeFormat.description')">
                        <div class="grid grid-cols-2 gap-2">
                          <Button :variant="draftTimeFormat === '24h' ? 'secondary' : 'outline'" type="button" @click="draftTimeFormat = '24h'">
                            24h
                          </Button>
                          <Button :variant="draftTimeFormat === '12h' ? 'secondary' : 'outline'" type="button" @click="draftTimeFormat = '12h'">
                            12h
                          </Button>
                        </div>
                      </PreferenceRow>
                      <Separator />
                      <PreferenceRow icon="event" :title="$t('settings.languageRegion.datePreview.title')" :description="$t('settings.languageRegion.datePreview.description')">
                        <span class="rounded-lg bg-surface-container-high px-3 py-2 text-sm font-bold text-on-surface capitalize">
                          {{ datePreview }}
                        </span>
                      </PreferenceRow>
                    </CardContent>
                  </Card>

                  <Transition
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="translate-y-4 opacity-0"
                    enter-to-class="translate-y-0 opacity-100"
                    leave-active-class="transition duration-150 ease-in"
                    leave-from-class="translate-y-0 opacity-100"
                    leave-to-class="translate-y-4 opacity-0"
                  >
                    <div v-if="isDirty" class="sticky bottom-4 z-10 mx-auto mt-4 max-w-fit rounded-xl border border-outline-variant bg-surface-container p-3 shadow-lg flex items-center gap-4">
                      <span class="text-sm font-semibold text-on-surface">{{ $t('settings.common.youHaveUnsavedChanges') }}</span>
                      <div class="flex items-center gap-2">
                        <Button variant="ghost" @click="syncDrafts">{{ $t('settings.common.reset') }}</Button>
                        <Button @click="applyChanges">{{ $t('settings.common.applyChanges') }}</Button>
                      </div>
                    </div>
                  </Transition>
                </div>
              </template>

              <template v-else-if="activeTab === 'general'">
                <Card>
                  <CardHeader>
                    <CardTitle>{{ $t('settings.general.title') }}</CardTitle>
                    <CardDescription>{{ $t('settings.general.description') }}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PreferenceRow icon="home" :title="$t('settings.general.startupView.title')" :description="$t('settings.general.startupView.description')">
                      <div class="grid grid-cols-2 gap-2">
                        <Button :variant="startupView === 'messages' ? 'secondary' : 'outline'" type="button" @click="startupView = 'messages'">
                          {{ $t('settings.general.startupView.messages') }}
                        </Button>
                        <Button :variant="startupView === 'friends' ? 'secondary' : 'outline'" type="button" @click="startupView = 'friends'">
                          {{ $t('settings.general.startupView.friends') }}
                        </Button>
                      </div>
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="dock_to_left" :title="$t('settings.general.sidebarStyle.title')" :description="$t('settings.general.sidebarStyle.description')">
                      <div class="grid grid-cols-2 gap-2">
                        <Button :variant="sidebarMode === 'hover' ? 'secondary' : 'outline'" type="button" @click="sidebarMode = 'hover'">
                          {{ $t('settings.general.sidebarStyle.hover') }}
                        </Button>
                        <Button :variant="sidebarMode === 'icons' ? 'secondary' : 'outline'" type="button" @click="sidebarMode = 'icons'">
                          {{ $t('settings.general.sidebarStyle.icons') }}
                        </Button>
                      </div>
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="animated_images" :title="$t('settings.general.autoplayMedia.title')" :description="$t('settings.general.autoplayMedia.description')">
                      <Switch v-model:checked="autoplayMedia" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="motion_photos_off" :title="$t('settings.general.reduceMotion.title')" :description="$t('settings.general.reduceMotion.description')">
                      <Switch v-model:checked="reduceMotion" />
                    </PreferenceRow>
                  </CardContent>
                </Card>
              </template>

              <template v-else-if="activeTab === 'privacy'">
                <Card>
                  <CardHeader>
                    <CardTitle>{{ $t('settings.privacy.title') }}</CardTitle>
                    <CardDescription>{{ $t('settings.privacy.description') }}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PreferenceRow icon="radio_button_checked" :title="$t('settings.privacy.activeStatus.title')" :description="$t('settings.privacy.activeStatus.description')">
                      <Switch v-model:checked="activeStatusVisible" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="done_all" :title="$t('settings.privacy.readReceipts.title')" :description="$t('settings.privacy.readReceipts.description')">
                      <Switch v-model:checked="readReceipts" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="badge" :title="$t('settings.privacy.profileVisibility.title')" :description="$t('settings.privacy.profileVisibility.description')">
                      <Switch v-model:checked="profileVisible" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="mark_chat_unread" :title="$t('settings.privacy.messageRequests.title')" :description="$t('settings.privacy.messageRequests.description')">
                      <select
                        v-model="messageRequestPolicy"
                        class="h-10 min-w-44 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="everyone">{{ $t('settings.privacy.messageRequests.everyone') }}</option>
                        <option value="friends">{{ $t('settings.privacy.messageRequests.friends') }}</option>
                        <option value="none">{{ $t('settings.privacy.messageRequests.none') }}</option>
                      </select>
                    </PreferenceRow>
                  </CardContent>
                </Card>
              </template>

              <template v-else-if="activeTab === 'account'">
                <AccountTab />
              </template>

              <template v-else>
                <Card>
                  <CardHeader>
                    <CardTitle>{{ $t('settings.notifications.title') }}</CardTitle>
                    <CardDescription>{{ $t('settings.notifications.description') }}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PreferenceRow icon="notifications_active" :title="$t('settings.notifications.pushDevice.title')" :description="$t('settings.notifications.pushDevice.description')">
                      <Switch
                        :checked="pushNotificationsStore.isEnabled"
                        :disabled="pushNotificationsStore.isLoading || pushNotificationsStore.permission === 'unsupported'"
                        @update:checked="togglePushNotifications"
                      />
                    </PreferenceRow>
                    <p v-if="pushNotificationsStore.permission === 'denied'" class="pb-3 text-xs font-semibold text-error">
                      {{ $t('settings.notifications.pushDevice.denied') }}
                    </p>
                    <p v-else-if="pushNotificationsStore.permission === 'unsupported'" class="pb-3 text-xs font-semibold text-on-surface-variant">
                      {{ $t('settings.notifications.pushDevice.unsupported') }}
                    </p>
                    <p v-else-if="pushNotificationsStore.error" class="pb-3 text-xs font-semibold text-error">
                      {{ pushNotificationsStore.error }}
                    </p>
                    <Separator />
                    <PreferenceRow icon="chat_bubble" :title="$t('settings.notifications.messagePreview.title')" :description="$t('settings.notifications.messagePreview.description')">
                      <Switch v-model:checked="messagePreview" />
                    </PreferenceRow>
                    <Separator />
                    <PreferenceRow icon="volume_up" :title="$t('settings.notifications.sound.title')" :description="$t('settings.notifications.sound.description')">
                      <Switch v-model:checked="notificationSound" />
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
