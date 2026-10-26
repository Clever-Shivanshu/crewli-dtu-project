import { create } from 'zustand';

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'cancel' | 'default' | 'destructive';
};

export type AlertState = {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  loading: boolean;
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
  hide: () => void;
  showLoading: (title: string, message?: string) => void;
};

export const useAlert = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  loading: false,
  show: (title, message = '', buttons = [{ text: 'OK' }]) =>
    set({ visible: true, title, message, buttons, loading: false }),
  showLoading: (title, message = '') =>
    set({ visible: true, title, message, buttons: [], loading: true }),
  hide: () => set({ visible: false, loading: false }),
}));

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  useAlert.getState().show(title, message, buttons);
}

export function showLoading(title: string, message?: string) {
  useAlert.getState().showLoading(title, message);
}
