import Geolocation from '@react-native-community/geolocation';
import { api } from './api';
import { getSocket } from './socket';

type LatLng = { lat: number; lng: number };

let watchId: number | null = null;
let lastSent: LatLng | null = null;
let activeJobId: string | null = null;

const MIN_DISTANCE_METERS = 250;

function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function startLocationTracking(jobId: string) {
  stopLocationTracking();
  activeJobId = jobId;
  lastSent = null;

  watchId = Geolocation.watchPosition(
    (pos) => {
      const next: LatLng = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      // First fix always goes through so the customer sees the worker immediately.
      if (!lastSent || distanceMeters(lastSent, next) >= MIN_DISTANCE_METERS) {
        lastSent = next;
        api.sendWorkerLocation(next, activeJobId || undefined).catch(() => {});
        try {
          getSocket().emit('worker_location', {
            jobId: activeJobId,
            lat: next.lat,
            lng: next.lng,
            ts: Date.now(),
          });
        } catch {}
      }
    },
    () => {},
    {
      enableHighAccuracy: true,
      distanceFilter: 50,
      interval: 5000,
      fastestInterval: 2000,
    } as any
  );
}

export function stopLocationTracking() {
  if (watchId !== null) {
    try {
      Geolocation.clearWatch(watchId);
    } catch {}
    watchId = null;
  }
  activeJobId = null;
  lastSent = null;
}

export function getTrackedJobId() {
  return activeJobId;
}
