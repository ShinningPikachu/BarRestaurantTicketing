export const colors = {
  primary: '#0F766E',
  primaryLight: '#14B8A6',
  primaryDark: '#115E59',
  primaryAccent: '#F59E0B',

  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F8FAFC',
  surfaceMuted: '#F1F5F9',

  text: '#111827',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textLight: '#FFFFFF',
  textBlack: '#111827',

  border: '#E2E8F0',
  borderLight: '#EEF2F7',
  borderDark: '#CBD5E1',

  buttonPrimary: '#0F766E',
  buttonPrimaryText: '#FFFFFF',
  buttonSecondary: '#F1F5F9',
  buttonSecondaryText: '#0F172A',

  zoneTable: '#FFF7ED',
  zoneMenu: '#F0FDFA',

  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',

  inputBackground: '#FFFFFF',
  inputBorder: '#CBD5E1',
  inputText: '#111827',
  inputPlaceholder: '#94A3B8',
} as const;

export type ColorKey = keyof typeof colors;
