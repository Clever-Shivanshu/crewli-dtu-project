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
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
  hide: () => void;
};

export const useAlert = create<AlertState>((set) => ({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  show: (title, message = '', buttons = [{ text: 'OK' }]) =>
    set({ visible: true, title, message, buttons }),
  hide: () => set({ visible: false }),
}));

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  useAlert.getState().show(title, message, buttons);
}
