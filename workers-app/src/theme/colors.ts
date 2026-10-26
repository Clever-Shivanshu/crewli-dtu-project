export const darkColors = {
  bg: '#0b0f19',
  card: '#111827',
  cardBorder: '#1f2937',
  input: '#1f2937',
  text: '#ffffff',
  textMuted: '#9ca3af',
  textFaint: '#6b7280',
  accent: '#2563eb',
  accentSoft: '#1d4ed8',
  success: '#22c55e',
  danger: '#ef4444',
  warn: '#f59e0b',
  link: '#60a5fa',
};

export const lightColors: typeof darkColors = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#e5e7eb',
  input: '#f1f5f9',
  text: '#0f172a',
  textMuted: '#475569',
  textFaint: '#64748b',
  accent: '#2563eb',
  accentSoft: '#1d4ed8',
  success: '#16a34a',
  danger: '#dc2626',
  warn: '#d97706',
  link: '#2563eb',
};

export type ThemeColors = typeof darkColors;
