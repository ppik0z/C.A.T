import { createI18n } from 'vue-i18n';
import en from './locales/en';
import vi from './locales/vi';

const messages = {
  en,
  vi,
};

export const i18n = createI18n({
  legacy: false, // Use Composition API
  locale: 'vi', // default locale
  fallbackLocale: 'en',
  messages,
});
