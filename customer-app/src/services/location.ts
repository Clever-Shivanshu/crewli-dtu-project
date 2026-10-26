import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { LatLng } from './api';

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Location needed',
      message: 'Crewli uses your location to find workers near you.',
      buttonPositive: 'Allow',
      buttonNegative: 'Cancel',
    }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function hasLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
}

export function getCurrentLocation(): Promise<LatLng | null> {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

export async function ensureAndGetLocation(): Promise<LatLng | null> {
  const ok = (await hasLocationPermission()) || (await requestLocationPermission());
  if (!ok) return null;
  return getCurrentLocation();
}
