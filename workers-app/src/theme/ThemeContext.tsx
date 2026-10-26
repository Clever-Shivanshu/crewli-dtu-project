import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { darkColors, lightColors, ThemeColors } from './colors';

export type ThemeMode = 'system' | 'light' | 'dark';

type PrefState = {
  mode: ThemeMode;
  hydrated: boolean;
  setMode: (m: ThemeMode) => void;
};

export const useThemePref = create<PrefState>()(
  persist(
    (set) => ({
      mode: 'system',
      hydrated: false,
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'crewli.theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mode: s.mode }),
      onRehydrateStorage: () => () => {
        useThemePref.setState({ hydrated: true });
      },
    }
  )
);

type Ctx = { colors: ThemeColors; isDark: boolean; mode: ThemeMode };
const ThemeContext = createContext<Ctx>({
  colors: darkColors,
  isDark: true,
  mode: 'system',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemePref((s) => s.mode);
  const [sys, setSys] = useState(Appearance.getColorScheme() || 'dark');

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSys(colorScheme || 'dark');
    });
    return () => sub.remove();
  }, []);

  const effective = mode === 'system' ? sys : mode;
  const isDark = effective !== 'light';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark, mode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
