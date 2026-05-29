import {
  defaultThemePresetId,
  resolveThemePreset,
  type ThemeColorTokens,
  type ThemePreset,
  type ThemePresetId,
} from './themePresets';

const storageKey = 'chatchoi.themePresetId';

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

let currentThemePresetId: ThemePresetId = defaultThemePresetId;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const persistThemePreset = (presetId: ThemePresetId) => {
  if (!canUseStorage()) return;
  localStorage.setItem(storageKey, presetId);
};

export const getCurrentThemePresetId = () => currentThemePresetId;

export const applyThemePreset = (preset: ThemePreset) => {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  Object.entries(tokenCssVariables).forEach(([tokenName, cssVariable]) => {
    root.style.setProperty(cssVariable, preset.colors[tokenName as keyof ThemeColorTokens]);
  });
  root.dataset.themePreset = preset.id;
  root.classList.toggle('dark', preset.isDark);
};

export const setThemePresetRuntime = (presetId: ThemePresetId) => {
  const preset = resolveThemePreset(presetId);
  currentThemePresetId = preset.id;
  applyThemePreset(preset);
  persistThemePreset(preset.id);
  return preset;
};

export const initializeThemePreference = () => {
  const storedPresetId = canUseStorage() ? localStorage.getItem(storageKey) : null;
  setThemePresetRuntime(resolveThemePreset(storedPresetId).id);
};
