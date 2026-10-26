// Back-compat shim: existing screens import { theme } from '../theme'.
// New screens should import { useTheme } from './theme/ThemeContext' to get
// light/dark-reactive colours. This static export always returns the dark
// palette so no in-flight screen looks broken after the theme refactor.
import { darkColors } from './theme/colors';

export const theme = darkColors;
export type { ThemeColors } from './theme/colors';
export { darkColors, lightColors } from './theme/colors';
export { ThemeProvider, useTheme, useThemePref } from './theme/ThemeContext';
export type { ThemeMode } from './theme/ThemeContext';
