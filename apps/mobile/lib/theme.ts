// Design tokens for Balkina AI mobile app

export const colors = {
  // Brand
  brand: '#6B7FC4',
  brandDark: '#4338ca',
  brandLight: '#eef2ff',
  brandBorder: '#c7d2fe',

  // Grays
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  gray900: '#111827',

  // Semantic
  white: '#fff',
  success: '#16a34a',
  successLight: '#dcfce7',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  warningDark: '#92400e',
  warningBg: '#FEF9EE',
  error: '#ef4444',
  errorDark: '#dc2626',
  errorBg: '#FEF2F2',
  errorDeep: '#991b1b',
  star: '#f59e0b',

  // Chat
  bubbleUser: '#6B7FC4',
  bubbleAssistant: '#f3f4f6',
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
} as const;

export const spacing = {
  xs: 2,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  xxxl: 24,
} as const;

export const borderRadius = {
  sm: 4,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  pill: 20,
  circle: 32,
  bubble: 18,
} as const;

export const typography = {
  // Font sizes
  xs: 10,
  sm: 11,
  body: 13,
  md: 14,
  lg: 15,
  xl: 16,
  xxl: 17,
  title: 18,
  heading: 20,
  hero: 22,

  // Line heights
  bodyLineHeight: 23,
  titleLineHeight: 21,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
} as const;
