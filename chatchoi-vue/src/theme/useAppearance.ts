import { computed, ref } from 'vue';
import { resolveThemePreset, type ThemePresetId } from './themePresets';
import { getCurrentAppearance, setAppearanceRuntime } from './appearanceRuntime';
import type { FontChoice, FontSize, MessageDensity } from '@/types/settings';

// Global state reflecting the applied settings
const current = getCurrentAppearance();
const activePresetId = ref<ThemePresetId>(current.themePresetId);
const activeFont = ref<FontChoice>(current.fontChoice);
const activeFontSize = ref<FontSize>(current.fontSize);
const activeDensity = ref<MessageDensity>(current.messageDensity);

export const useAppearance = () => {
  const activePreset = computed(() => resolveThemePreset(activePresetId.value));

  const commitAppearance = (presetId: ThemePresetId, font: FontChoice, fontSize: FontSize, density: MessageDensity) => {
    // Apply changes to DOM & localStorage
    setAppearanceRuntime(presetId, font, fontSize, density);
    
    // Update active state
    activePresetId.value = presetId;
    activeFont.value = font;
    activeFontSize.value = fontSize;
    activeDensity.value = density;
  };

  return {
    activePreset,
    activePresetId,
    activeFont,
    activeFontSize,
    activeDensity,
    commitAppearance,
  };
};
