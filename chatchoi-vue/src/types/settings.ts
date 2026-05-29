export type SettingsTabId =
  | 'appearance'
  | 'language'
  | 'general'
  | 'privacy'
  | 'account'
  | 'notifications';

export type FontChoice = 'jakarta' | 'lexend' | 'system' | 'inter' | 'roboto' | 'opensans';
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';
export type MessageDensity = 'comfortable' | 'compact';

export interface SettingsTab {
  id: SettingsTabId;
  icon: string;
  label: string;
  summary: string;
}

export interface SettingOption<TValue extends string> {
  value: TValue;
  label: string;
  description?: string;
  icon?: string;
}
