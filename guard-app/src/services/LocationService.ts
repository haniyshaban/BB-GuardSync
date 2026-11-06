// Location Service - Periodic GPS tracking during shift
import { guardApi } from './api';

let locationInterval: ReturnType<typeof setInterval> | null = null;

export function startLocationTracking(intervalMins: number = 30) {
  stopLocationTracking(); // Clear any existing

  // Send immediately
  sendLocation();

  // Then every intervalMins
  locationInterval = setInterval(() => {
    sendLocation();
  }, intervalMins * 60 * 1000);

  console.log(`[LocationService] Tracking started (every ${intervalMins} mins)`);
}

export function stopLocationTracking() {
  if (locationInterval) {
    clearInterval(locationInterval);
    locationInterval = null;
    console.log('[LocationService] Tracking stopped');
  }
}

async function sendLocation() {
  try {
    // Try Capacitor Geolocation first, fallback to browser API
    let lat: number, lng: number, accuracy: number | undefined;

    if ('geolocation' in navigator) {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        });
      });
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      accuracy = pos.coords.accuracy;
    } else {
      console.warn('[LocationService] Geolocation not available');
      return;
    }

    const battery = await getBatteryLevel();
    await guardApi.submitLocation(lat, lng, accuracy, battery);
    console.log(`[LocationService] Location sent: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  } catch (err) {
    console.error('[LocationService] Failed to send location:', err);
  }
}

export function isTracking(): boolean {
  return locationInterval !== null;
}

// Best-effort battery level (%) via the Battery Status API; undefined when unsupported.
async function getBatteryLevel(): Promise<number | undefined> {
  try {
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      const b = await nav.getBattery();
      if (b && typeof b.level === 'number') return Math.round(b.level * 100);
    }
  } catch {
    // ignore — battery reporting is optional
  }
  return undefined;
}
