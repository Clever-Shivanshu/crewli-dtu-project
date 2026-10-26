import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';

type CallDirectNative = {
  hasPermission: () => Promise<boolean>;
  call: (phone: string) => Promise<boolean>;
};

const Native = NativeModules.CallDirect as CallDirectNative | undefined;

/**
 * Start a phone call with the least friction possible:
 *   1. Ask for CALL_PHONE once; granted → direct call, no dialer.
 *   2. Denied / unavailable → fall through to tel: which opens the dialer
 *      with the number pre-filled (single tap to call).
 */
export async function callPhoneDirect(phone: string): Promise<void> {
  const digits = (phone || '').replace(/[^+0-9]/g, '');
  if (!digits) return;

  if (Platform.OS !== 'android' || !Native) {
    Linking.openURL(`tel:${digits}`).catch(() => {});
    return;
  }

  try {
    const already = await Native.hasPermission();
    if (!already) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        {
          title: 'Call directly',
          message:
            'Allow Crewli to start calls without opening the dialer first.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not now',
        }
      );
    }
    await Native.call(digits);
  } catch {
    Linking.openURL(`tel:${digits}`).catch(() => {});
  }
}
