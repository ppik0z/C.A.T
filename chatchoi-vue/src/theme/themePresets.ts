export type ThemePresetId = 'default' | 'dark' | 'midnight' | 'mint' | 'rose';

export interface ThemeColorTokens {
  primary: string;
  primaryContainer: string;
  onPrimary: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  tertiaryContainer: string;
  error: string;
  onError: string;
  errorContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  surfaceContainerLowest: string;
  surfaceContainerLow: string;
  surfaceContainer: string;
  surfaceContainerHigh: string;
  surfaceContainerHighest: string;
  surfaceDim: string;
  outline: string;
  outlineVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  success: string;
  successContainer: string;
  onSuccess: string;
  onSuccessContainer: string;
  warning: string;
  warningContainer: string;
  onWarningContainer: string;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  isDark: boolean;
  colors: ThemeColorTokens;
}

export const defaultThemePresetId: ThemePresetId = 'default';

export const themePresets: ThemePreset[] = [
  {
    id: 'default',
    name: 'Chatchoi',
    description: 'Sáng, sạch, cân bằng cho chat hằng ngày.',
    isDark: false,
    colors: {
      primary: '#0866ff',
      primaryContainer: '#e7f0ff',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#0646b3',
      secondary: '#5f6673',
      secondaryContainer: '#e9edf3',
      onSecondaryContainer: '#303640',
      tertiary: '#6d5bd0',
      tertiaryContainer: '#eeeaff',
      error: '#ba1a1a',
      onError: '#ffffff',
      errorContainer: '#ffdad6',
      background: '#f5f7fb',
      onBackground: '#1c1e21',
      surface: '#f5f7fb',
      surfaceContainerLowest: '#ffffff',
      surfaceContainerLow: '#f7f8fa',
      surfaceContainer: '#f0f2f5',
      surfaceContainerHigh: '#e9edf2',
      surfaceContainerHighest: '#e4e7eb',
      surfaceDim: '#d6dae0',
      outline: '#727985',
      outlineVariant: '#d8dde4',
      onSurface: '#1c1e21',
      onSurfaceVariant: '#59616c',
      success: '#12805c',
      successContainer: '#d8f5e8',
      onSuccess: '#ffffff',
      onSuccessContainer: '#083d2b',
      warning: '#8a5a00',
      warningContainer: '#ffe2a9',
      onWarningContainer: '#5f3d00',
    },
  },
  {
    id: 'dark',
    name: 'Graphite',
    description: 'Nền tối trung tính, ít chói khi dùng lâu.',
    isDark: true,
    colors: {
      primary: '#7cc7e8',
      primaryContainer: '#12384a',
      onPrimary: '#062231',
      onPrimaryContainer: '#d7f0ff',
      secondary: '#d9ca65',
      secondaryContainer: '#423c00',
      onSecondaryContainer: '#f5ec9c',
      tertiary: '#ffb4ad',
      tertiaryContainer: '#5f2f2d',
      error: '#ffb4ab',
      onError: '#690005',
      errorContainer: '#690005',
      background: '#101418',
      onBackground: '#e1e3e8',
      surface: '#101418',
      surfaceContainerLowest: '#0b0f12',
      surfaceContainerLow: '#181c20',
      surfaceContainer: '#1c2024',
      surfaceContainerHigh: '#262a2f',
      surfaceContainerHighest: '#31353a',
      surfaceDim: '#101418',
      outline: '#8b9198',
      outlineVariant: '#42484f',
      onSurface: '#e1e3e8',
      onSurfaceVariant: '#c1c7cf',
      success: '#6fd8ad',
      successContainer: '#0d4f38',
      onSuccess: '#003824',
      onSuccessContainer: '#c7f5df',
      warning: '#f0c36a',
      warningContainer: '#573f00',
      onWarningContainer: '#ffdfa0',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Tối sâu hơn, nhấn xanh cho không gian tập trung.',
    isDark: true,
    colors: {
      primary: '#91d5ff',
      primaryContainer: '#043854',
      onPrimary: '#042333',
      onPrimaryContainer: '#d9efff',
      secondary: '#b8c7ff',
      secondaryContainer: '#27345f',
      onSecondaryContainer: '#dce3ff',
      tertiary: '#ddb8ff',
      tertiaryContainer: '#4a2d61',
      error: '#ffb4ab',
      onError: '#680006',
      errorContainer: '#680006',
      background: '#0b1020',
      onBackground: '#e6e8f2',
      surface: '#0b1020',
      surfaceContainerLowest: '#070b16',
      surfaceContainerLow: '#11172a',
      surfaceContainer: '#171d31',
      surfaceContainerHigh: '#22283d',
      surfaceContainerHighest: '#2d3349',
      surfaceDim: '#0b1020',
      outline: '#8d93a8',
      outlineVariant: '#41485d',
      onSurface: '#e6e8f2',
      onSurfaceVariant: '#c4c9db',
      success: '#7ae2b8',
      successContainer: '#0b5339',
      onSuccess: '#003824',
      onSuccessContainer: '#cdf8e4',
      warning: '#f2c36b',
      warningContainer: '#573f00',
      onWarningContainer: '#ffdfa0',
    },
  },
  {
    id: 'mint',
    name: 'Mint',
    description: 'Sáng nhẹ, tươi, hợp cho giao diện thân thiện.',
    isDark: false,
    colors: {
      primary: '#0f6b55',
      primaryContainer: '#b8ecd9',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#00382a',
      secondary: '#4e665b',
      secondaryContainer: '#d0e9dc',
      onSecondaryContainer: '#0b2118',
      tertiary: '#3d6472',
      tertiaryContainer: '#c0e9f6',
      error: '#ba1a1a',
      onError: '#ffffff',
      errorContainer: '#ffdad6',
      background: '#f6fbf7',
      onBackground: '#151d19',
      surface: '#f6fbf7',
      surfaceContainerLowest: '#ffffff',
      surfaceContainerLow: '#eef7f1',
      surfaceContainer: '#e5f0e9',
      surfaceContainerHigh: '#dce8e1',
      surfaceContainerHighest: '#d3e1d9',
      surfaceDim: '#c7d8cf',
      outline: '#6f7b73',
      outlineVariant: '#becbc2',
      onSurface: '#151d19',
      onSurfaceVariant: '#404942',
      success: '#0f7a58',
      successContainer: '#c9f4df',
      onSuccess: '#ffffff',
      onSuccessContainer: '#003d2b',
      warning: '#7a5c00',
      warningContainer: '#ffdf95',
      onWarningContainer: '#493700',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    description: 'Ấm hơn nhưng vẫn giữ độ tương phản cho nội dung.',
    isDark: false,
    colors: {
      primary: '#98505d',
      primaryContainer: '#ffd9df',
      onPrimary: '#ffffff',
      onPrimaryContainer: '#3f0014',
      secondary: '#74565d',
      secondaryContainer: '#ffd9df',
      onSecondaryContainer: '#2b151b',
      tertiary: '#7b5634',
      tertiaryContainer: '#ffdcc1',
      error: '#ba1a1a',
      onError: '#ffffff',
      errorContainer: '#ffdad6',
      background: '#fff8f8',
      onBackground: '#21191b',
      surface: '#fff8f8',
      surfaceContainerLowest: '#ffffff',
      surfaceContainerLow: '#fff0f2',
      surfaceContainer: '#f9e4e8',
      surfaceContainerHigh: '#efd9de',
      surfaceContainerHighest: '#e6ced4',
      surfaceDim: '#dec2c8',
      outline: '#857379',
      outlineVariant: '#d7c1c7',
      onSurface: '#21191b',
      onSurfaceVariant: '#524347',
      success: '#2f7b57',
      successContainer: '#d5f4df',
      onSuccess: '#ffffff',
      onSuccessContainer: '#003d25',
      warning: '#805a00',
      warningContainer: '#ffdea4',
      onWarningContainer: '#4c3700',
    },
  },
];

export const themePresetById = new Map(themePresets.map((preset) => [preset.id, preset]));

export const resolveThemePreset = (presetId: string | null): ThemePreset => {
  return themePresetById.get(presetId as ThemePresetId) ?? themePresetById.get(defaultThemePresetId)!;
};
