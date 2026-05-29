import { i18n } from './index';
import type { LanguageChoice, TimeFormat } from '@/types/settings';

const storageKeyLanguage = 'chatchoi.language';
const storageKeyTimeFormat = 'chatchoi.timeFormat';
const storageKeyTimezone = 'chatchoi.timezone';

const defaultLanguage: LanguageChoice = 'vi';
const defaultTimeFormat: TimeFormat = '24h';
const defaultTimezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;

let currentLanguage: LanguageChoice = defaultLanguage;
let currentTimeFormat: TimeFormat = defaultTimeFormat;
let currentTimezone: string = defaultTimezone;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

export const applyLanguage = (lang: LanguageChoice) => {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  // Apply to vue-i18n
  if (i18n.global) {
    (i18n.global.locale as any).value = lang;
  }
};

export const setLocalizationRuntime = (lang: LanguageChoice, timeFormat: TimeFormat, timezone: string) => {
  currentLanguage = lang;
  currentTimeFormat = timeFormat;
  currentTimezone = timezone;

  applyLanguage(lang);

  if (canUseStorage()) {
    localStorage.setItem(storageKeyLanguage, lang);
    localStorage.setItem(storageKeyTimeFormat, timeFormat);
    localStorage.setItem(storageKeyTimezone, timezone);
  }
};

export const initializeLocalization = () => {
  let storedLanguage: string | null = null;
  let storedTimeFormat: string | null = null;
  let storedTimezone: string | null = null;

  if (canUseStorage()) {
    storedLanguage = localStorage.getItem(storageKeyLanguage);
    storedTimeFormat = localStorage.getItem(storageKeyTimeFormat);
    storedTimezone = localStorage.getItem(storageKeyTimezone);
  }

  const lang = (storedLanguage as LanguageChoice) || defaultLanguage;
  const timeFmt = (storedTimeFormat as TimeFormat) || defaultTimeFormat;
  const tz = storedTimezone || defaultTimezone;

  setLocalizationRuntime(lang, timeFmt, tz);
};

export const getCurrentLocalization = () => ({
  language: currentLanguage,
  timeFormat: currentTimeFormat,
  timezone: currentTimezone,
});
