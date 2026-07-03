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

/**
 * Watch the GPS for up to `maxWaitMs` and return the most accurate fix seen,
 * resolving early once accuracy is within `goodEnoughMeters`. Indoors, the first
 * fix is often a coarse Wi-Fi/cell estimate hundreds of meters off — sampling for
 * a few seconds lets the device converge before we run the geofence check.
 */
export function getBestPosition(maxWaitMs = 8_000, goodEnoughMeters = 25): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'))
      return
    }

    let best: Coords | null = null
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      navigator.geolocation.clearWatch(watchId)
      if (best) resolve(best)
      else reject(new Error('GPS signal weak. Cannot verify your location.'))
    }

    const timer = setTimeout(finish, maxWaitMs)

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }
        if (!best || fix.accuracy < best.accuracy) best = fix
        if (fix.accuracy <= goodEnoughMeters) finish()
      },
      (err) => {
        // Only bail early on a hard permission denial; transient errors just
        // mean "keep waiting for the timer / a later fix".
        if (err.code === err.PERMISSION_DENIED) {
          settled = true
          clearTimeout(timer)
          navigator.geolocation.clearWatch(watchId)
          reject(new Error('Location permission denied. Enable location to use geofencing.'))
        }
      },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 },
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
