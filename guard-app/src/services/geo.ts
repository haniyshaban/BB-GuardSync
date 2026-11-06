// Shared geolocation helper for guard-facing features.
export async function getPosition(timeout = 15000): Promise<{ lat?: number; lng?: number }> {
  if (!('geolocation' in navigator)) return {};
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout, maximumAge: 30000 });
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return {};
  }
}
