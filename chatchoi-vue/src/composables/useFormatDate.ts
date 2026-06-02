import { computed, type Ref } from 'vue';
import type { LanguageChoice, TimeFormat } from '@/types/settings';

export const useFormatDate = (
  date: Date,
  language: Ref<LanguageChoice>,
  timeFormat: Ref<TimeFormat>,
  timezone: Ref<string>
) => {
  return computed(() => {
    try {
      const is12h = timeFormat.value === '12h';
      
      const formatter = new Intl.DateTimeFormat(language.value === 'vi' ? 'vi-VN' : 'en-US', {
        timeZone: timezone.value,
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: is12h,
      });
      return formatter.format(date);
    } catch (e) {
      // Fallback if timezone is somehow invalid
      console.error('Invalid Date/Timezone formatting', e);
      return date.toString();
    }
  });
};
