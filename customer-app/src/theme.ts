// Back-compat shim: existing screens import { theme } from '../theme'.
// New screens should import { useTheme } from './theme/ThemeContext'.
import { darkColors } from './theme/colors';

export const theme = darkColors;
export type { ThemeColors } from './theme/colors';
export { darkColors, lightColors } from './theme/colors';
export { ThemeProvider, useTheme, useThemePref } from './theme/ThemeContext';
export type { ThemeMode } from './theme/ThemeContext';
