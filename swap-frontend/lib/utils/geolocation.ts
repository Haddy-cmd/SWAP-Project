export interface Coords {
  latitude: number
  longitude: number
  accuracy: number
}

/**
 * Promise wrapper around the browser Geolocation API.
 * Rejects with a human-readable message on permission denial / timeout / unavailability.
 */
export function getCurrentPosition(options?: PositionOptions): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied. Enable location to use geofencing.'))
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new Error('GPS signal weak. Cannot verify your location.'))
        } else {
          reject(new Error('Could not read your location. Please try again.'))
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0, ...options },
    )
  })
}

const EARTH_RADIUS_METERS = 6_371_000

/** Great-circle distance between two coordinates in meters (Haversine). */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_METERS * c
}
