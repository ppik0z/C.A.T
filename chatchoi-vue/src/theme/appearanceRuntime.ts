import {
  defaultThemePresetId,
  resolveThemePreset,
  type ThemeColorTokens,
  type ThemePreset,
  type ThemePresetId,
} from './themePresets';
import type { FontChoice, FontSize, MessageDensity } from '@/types/settings';

const storageKeyTheme = 'chatchoi.themePresetId';
const storageKeyFont = 'chatchoi.fontChoice';
const storageKeyFontSize = 'chatchoi.fontSize';
const storageKeyDensity = 'chatchoi.messageDensity';

const tokenCssVariables: Record<keyof ThemeColorTokens, string> = {
  primary: '--theme-primary',
  primaryContainer: '--theme-primary-container',
  onPrimary: '--theme-on-primary',
  onPrimaryContainer: '--theme-on-primary-container',
  secondary: '--theme-secondary',
  secondaryContainer: '--theme-secondary-container',
  onSecondaryContainer: '--theme-on-secondary-container',
  tertiary: '--theme-tertiary',
  tertiaryContainer: '--theme-tertiary-container',
  error: '--theme-error',
  onError: '--theme-on-error',
  errorContainer: '--theme-error-container',
  background: '--theme-background',
  onBackground: '--theme-on-background',
  surface: '--theme-surface',
  surfaceContainerLowest: '--theme-surface-container-lowest',
  surfaceContainerLow: '--theme-surface-container-low',
  surfaceContainer: '--theme-surface-container',
  surfaceContainerHigh: '--theme-surface-container-high',
  surfaceContainerHighest: '--theme-surface-container-highest',
  surfaceDim: '--theme-surface-dim',
  outline: '--theme-outline',
  outlineVariant: '--theme-outline-variant',
  onSurface: '--theme-on-surface',
  onSurfaceVariant: '--theme-on-surface-variant',
  success: '--theme-success',
  successContainer: '--theme-success-container',
  onSuccess: '--theme-on-success',
  onSuccessContainer: '--theme-on-success-container',
  warning: '--theme-warning',
  warningContainer: '--theme-warning-container',
  onWarningContainer: '--theme-on-warning-container',
};

const fontFamilies: Record<FontChoice, string> = {
  jakarta: '"Plus Jakarta Sans", sans-serif',
  lexend: '"Lexend", sans-serif',
  system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  inter: '"Inter", sans-serif',
  roboto: '"Roboto", sans-serif',
  opensans: '"Open Sans", sans-serif',
};

const fontSizeMap: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
  'extra-large': '20px',
};

const defaultFontChoice: FontChoice = 'jakarta';
const defaultFontSize: FontSize = 'medium';
const defaultDensity: MessageDensity = 'comfortable';

let currentThemePresetId: ThemePresetId = defaultThemePresetId;
let currentFontChoice: FontChoice = defaultFontChoice;
let currentFontSize: FontSize = defaultFontSize;
let currentDensity: MessageDensity = defaultDensity;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Core apply functions
export const applyThemePreset = (preset: ThemePreset) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(tokenCssVariables).forEach(([tokenName, cssVariable]) => {
    root.style.setProperty(cssVariable, preset.colors[tokenName as keyof ThemeColorTokens]);
  });
  root.dataset.themePreset = preset.id;
  root.classList.toggle('dark', preset.isDark);
};

export const applyFontChoice = (font: FontChoice) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--font-body', fontFamilies[font] || fontFamilies[defaultFontChoice]);
  // Use the same font for labels or specifically map it if needed
  root.style.setProperty('--font-label', font === 'jakarta' ? fontFamilies['lexend'] : (fontFamilies[font] || fontFamilies[defaultFontChoice]));
};

export const applyFontSize = (size: FontSize) => {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = fontSizeMap[size] || fontSizeMap[defaultFontSize];
};

export const applyDensity = (density: MessageDensity) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.density = density;
};

// Set and persist functions
export const setAppearanceRuntime = (presetId: ThemePresetId, font: FontChoice, fontSize: FontSize, density: MessageDensity) => {
  const preset = resolveThemePreset(presetId);
  currentThemePresetId = preset.id;
  currentFontChoice = font;
  currentFontSize = fontSize;
  currentDensity = density;

  applyThemePreset(preset);
  applyFontChoice(font);
  applyFontSize(fontSize);
  applyDensity(density);

  if (canUseStorage()) {
    localStorage.setItem(storageKeyTheme, preset.id);
    localStorage.setItem(storageKeyFont, font);
    localStorage.setItem(storageKeyFontSize, fontSize);
    localStorage.setItem(storageKeyDensity, density);
  }
};

// Initialization
export const initializeAppearance = () => {
  let storedPresetId: string | null = null;
  let storedFont: string | null = null;
  let storedFontSize: string | null = null;
  let storedDensity: string | null = null;

  if (canUseStorage()) {
    storedPresetId = localStorage.getItem(storageKeyTheme);
    storedFont = localStorage.getItem(storageKeyFont);
    storedFontSize = localStorage.getItem(storageKeyFontSize);
    storedDensity = localStorage.getItem(storageKeyDensity);
  }

  const presetId = storedPresetId ? resolveThemePreset(storedPresetId).id : defaultThemePresetId;
  const fontChoice = (storedFont as FontChoice) || defaultFontChoice;
  const fontSize = (storedFontSize as FontSize) || defaultFontSize;
  const messageDensity = (storedDensity as MessageDensity) || defaultDensity;

  setAppearanceRuntime(presetId, fontChoice, fontSize, messageDensity);
};

// Getters
export const getCurrentAppearance = () => ({
  themePresetId: currentThemePresetId,
  fontChoice: currentFontChoice,
  fontSize: currentFontSize,
  messageDensity: currentDensity,
});
