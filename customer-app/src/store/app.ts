import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { LatLng } from '../services/api';

export type SavedAddress = {
  id: string;
  label: string;
  address: string;
  location?: LatLng | null;
};

type AppState = {
  location: LatLng | null;
  address: string;
  activeJobId: string | null;
  customerId: string | null;
  phone: string | null;
  name: string;
  imageUrl: string | null;
  verifiedAt: number | null;
  hydrated: boolean;

  savedAddresses: SavedAddress[];
  selectedAddressId: string | null;

  setLocation: (loc: LatLng | null) => void;
  setAddress: (a: string) => void;
  setActiveJob: (id: string | null) => void;
  setCustomerId: (id: string | null) => void;
  setPhone: (phone: string) => void;
  setName: (name: string) => void;
  setImageUrl: (url: string | null) => void;
  setProfile: (patch: { name?: string; address?: string }) => void;
  clearAuth: () => void;
  markHydrated: () => void;

  addSavedAddress: (addr: SavedAddress) => void;
  removeSavedAddress: (id: string) => void;
  selectAddress: (id: string) => void;
};

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      location: null,
      address: '',
      activeJobId: null,
      customerId: null,
      phone: null,
      name: '',
      imageUrl: null,
      verifiedAt: null,
      hydrated: false,
      savedAddresses: [],
      selectedAddressId: null,

      setLocation: (location) => set({ location }),
      setAddress: (address) => set({ address }),
      setActiveJob: (activeJobId) => set({ activeJobId }),
      setCustomerId: (customerId) => set({ customerId }),
      setPhone: (phone) => set({ phone, verifiedAt: Date.now() }),
      setName: (name) => set({ name }),
      setImageUrl: (imageUrl) => set({ imageUrl }),
      setProfile: (patch) =>
        set((s) => ({
          name: patch.name !== undefined ? patch.name : s.name,
          address: patch.address !== undefined ? patch.address : s.address,
        })),
      clearAuth: () => set({ customerId: null, phone: null, name: '', imageUrl: null, verifiedAt: null }),
      markHydrated: () => set({ hydrated: true }),

      addSavedAddress: (addr) =>
        set((s) => ({ savedAddresses: [...s.savedAddresses, addr] })),
      removeSavedAddress: (id) =>
        set((s) => ({
          savedAddresses: s.savedAddresses.filter((a) => a.id !== id),
          selectedAddressId: s.selectedAddressId === id ? null : s.selectedAddressId,
        })),
      selectAddress: (id) => {
        const addr = get().savedAddresses.find((a) => a.id === id);
        if (addr) {
          set({
            selectedAddressId: id,
            address: addr.address,
            location: addr.location || get().location,
          });
        }
      },
    }),
    {
      name: 'crewli.customer',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        location: s.location,
        address: s.address,
        activeJobId: s.activeJobId,
        customerId: s.customerId,
        phone: s.phone,
        name: s.name,
        imageUrl: s.imageUrl,
        verifiedAt: s.verifiedAt,
        savedAddresses: s.savedAddresses,
        selectedAddressId: s.selectedAddressId,
      }),
      onRehydrateStorage: () => () => {
        useApp.setState({ hydrated: true });
      },
    }
  )
);

export const getApp = () => useApp.getState();
