import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Moon, Smartphone, Sun } from 'lucide-react-native';
import { useTheme, useThemePref, ThemeMode } from '../theme/ThemeContext';

const ORDER: ThemeMode[] = ['system', 'light', 'dark'];

export function ThemeToggle() {
  const { colors } = useTheme();
  const mode = useThemePref((s) => s.mode);
  const setMode = useThemePref((s) => s.setMode);

  const Icon = mode === 'system' ? Smartphone : mode === 'light' ? Sun : Moon;

  function cycle() {
    const i = ORDER.indexOf(mode);
    setMode(ORDER[(i + 1) % ORDER.length]);
  }

  return (
    <TouchableOpacity
      onPress={cycle}
      style={[
        styles.btn,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
      hitSlop={8}
    >
      <Icon size={18} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
