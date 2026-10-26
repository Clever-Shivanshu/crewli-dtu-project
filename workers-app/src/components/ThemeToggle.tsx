import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Moon, Sun, SunMoon } from 'lucide-react-native';
import { useTheme, useThemePref, ThemeMode } from '../theme/ThemeContext';

/**
 * Compact icon-only button that cycles system → light → dark → system.
 * Lives in the dashboard header as a low-noise quick toggle.
 * The full labelled picker is still in the Profile screen.
 */
export function ThemeToggle() {
  const { colors } = useTheme();
  const mode = useThemePref((s) => s.mode);
  const setMode = useThemePref((s) => s.setMode);

  const next: Record<ThemeMode, ThemeMode> = {
    system: 'light',
    light: 'dark',
    dark: 'system',
  };
  const Icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : SunMoon;

  return (
    <TouchableOpacity
      onPress={() => setMode(next[mode])}
      style={[
        styles.btn,
        { backgroundColor: colors.input, borderColor: colors.cardBorder },
      ]}
      accessibilityLabel={`Theme: ${mode}. Tap to switch.`}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon size={16} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
