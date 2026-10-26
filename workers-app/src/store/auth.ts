import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LatLng = { lat: number; lng: number };

export type CachedWorker = {
  id: string;
  phone: string;
  name: string;
  language: string | null;
  profession: string | null;
  skills: string[];
  languages: string[];
  imageUrl: string | null;
  isAvailable: boolean;
  rating: number;
  fatigueScore: number;
  missedCount: number;
  jobsMissedCount: number;
  onboarded: boolean;
  location: LatLng | null;
};

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  worker: CachedWorker | null;
  lastRefreshAt: number; // epoch ms
  hydrated: boolean;

  setAuth: (v: {
    accessToken: string;
    refreshToken: string;
    worker: CachedWorker;
  }) => void;
  setWorker: (w: CachedWorker) => void;
  setAccessToken: (t: string, lastRefreshAt?: number) => void;
  clear: () => void;
  markHydrated: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      worker: null,
      lastRefreshAt: 0,
      hydrated: false,

      setAuth: ({ accessToken, refreshToken, worker }) =>
        set({
          accessToken,
          refreshToken,
          worker,
          lastRefreshAt: Date.now(),
        }),
      setWorker: (worker) => set({ worker }),
      setAccessToken: (accessToken, lastRefreshAt = Date.now()) =>
        set({ accessToken, lastRefreshAt }),
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          worker: null,
          lastRefreshAt: 0,
        }),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'crewli.auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        worker: s.worker,
        lastRefreshAt: s.lastRefreshAt,
      }),
      onRehydrateStorage: () => () => {
        // Called after the persisted state has been merged into the store.
        useAuth.setState({ hydrated: true });
      },
    }
  )
);

/** Read-only snapshot helper for non-React code (api client). */
export const getAuth = () => useAuth.getState();
