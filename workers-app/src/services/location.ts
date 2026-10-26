import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export type LatLng = { lat: number; lng: number };

/**
 * Ask for the foreground location permission. Returns true if granted.
 * On iOS this is a no-op stub that returns true — the native dialog is triggered
 * by the first getCurrentPosition() call and requires NSLocationWhenInUseUsageDescription.
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const already = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  if (already) return true;
  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Allow location access',
      message:
        'Crewli matches you with nearby jobs. Without location we cannot send you offers.',
      buttonPositive: 'Allow',
      buttonNegative: 'Not now',
    }
  );
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
}

/**
 * Read the current location once. Resolves with null on any failure (denial,
 * timeout, GPS off) so callers never have to try/catch.
 */
export function getCurrentLocation(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

/**
 * Convenience: ensure permission, then fetch. Returns null if permission is
 * denied or the fix fails. Callers should treat null as "don't send" rather
 * than an error.
 */
export async function ensureAndGetLocation(): Promise<LatLng | null> {
  const ok = await hasLocationPermission();
  if (!ok) {
    const granted = await requestLocationPermission();
    if (!granted) return null;
  }
  return getCurrentLocation();
}
