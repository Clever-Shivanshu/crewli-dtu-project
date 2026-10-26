import messaging from '@react-native-firebase/messaging';
import { api } from './api';

/**
 * Request notification permissions and return the FCM token.
 */
export async function requestFcmPermission(): Promise<string | null> {
  try {
    const status = await messaging().requestPermission();
    const enabled =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
    if (!enabled) {
      console.log('[FCM] Permission not granted');
      return null;
    }
    const token = await messaging().getToken();
    console.log('[FCM] Token:', token?.slice(0, 20) + '...');
    return token;
  } catch (e) {
    console.warn('[FCM] Error getting token:', e);
    return null;
  }
}

/**
 * Register the FCM token with the backend for push notifications.
 */
export async function registerFcmToken(customerId: string): Promise<void> {
  try {
    const token = await requestFcmPermission();
    if (token && customerId) {
      await api.sendFcmToken(customerId, token);
      console.log('[FCM] Token registered with backend');
    }
  } catch (e) {
    console.warn('[FCM] Failed to register token:', e);
  }
}

/**
 * Listen for foreground messages.
 */
export function onForegroundMessage(handler: (msg: any) => void) {
  return messaging().onMessage(handler);
}

/**
 * Listen for token refresh events.
 */
export function onTokenRefresh(handler: (token: string) => void) {
  return messaging().onTokenRefresh(handler);
}
