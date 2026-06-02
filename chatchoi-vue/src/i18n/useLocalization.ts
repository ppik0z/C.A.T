import { ref } from 'vue';
import { getCurrentLocalization, setLocalizationRuntime } from './localizationRuntime';
import type { LanguageChoice, TimeFormat } from '@/types/settings';

const current = getCurrentLocalization();
const activeLanguage = ref<LanguageChoice>(current.language as LanguageChoice);
const activeTimeFormat = ref<TimeFormat>(current.timeFormat as TimeFormat);
const activeTimezone = ref<string>(current.timezone);

export const useLocalization = () => {
  const commitLocalization = (lang: LanguageChoice, timeFormat: TimeFormat, timezone: string) => {
    setLocalizationRuntime(lang, timeFormat, timezone);
    activeLanguage.value = lang;
    activeTimeFormat.value = timeFormat;
    activeTimezone.value = timezone;
  };

  return {
    activeLanguage,
    activeTimeFormat,
    activeTimezone,
    commitLocalization,
  };
};
