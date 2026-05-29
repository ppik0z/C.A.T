import { computed, ref } from 'vue';
import {
  resolveThemePreset,
  type ThemePresetId,
} from './themePresets';
import { getCurrentThemePresetId, setThemePresetRuntime } from './themeRuntime';

const activePresetId = ref<ThemePresetId>(getCurrentThemePresetId());

export const useThemePreference = () => {
  const activePreset = computed(() => resolveThemePreset(activePresetId.value));
  const setThemePreset = (presetId: ThemePresetId) => {
    activePresetId.value = setThemePresetRuntime(presetId).id;
  };

  return {
    activePreset,
    activePresetId,
    setThemePreset,
  };
};
