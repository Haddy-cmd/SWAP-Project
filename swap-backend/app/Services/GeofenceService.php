<?php

namespace App\Services;

use App\Models\Office;

class GeofenceService
{
    private const EARTH_RADIUS_METERS = 6_371_000;

    /** Cap on how much GPS-accuracy slack we allow, so a very coarse fix can't defeat the fence. */
    private const MAX_ACCURACY_BUFFER_METERS = 100;

    /**
     * Whether the given coordinates fall within the office's geofence.
     * Offices without geofencing enabled (or missing coordinates) always pass.
     *
     * The device's GPS accuracy (uncertainty radius, in meters) is added as tolerance — consumer
     * GPS is routinely 20–50m off, so a correct location with a coarse fix should still pass.
     */
    public function isWithin(Office $office, float $latitude, float $longitude, ?float $accuracy = null): bool
    {
        if (!$office->geofence_enabled || $office->latitude === null || $office->longitude === null) {
            return true;
        }

        $distance = $this->distanceMeters(
            (float) $office->latitude,
            (float) $office->longitude,
            $latitude,
            $longitude
        );

        $tolerance = min((float) ($accuracy ?? 0), self::MAX_ACCURACY_BUFFER_METERS);

        return $distance <= ((float) $office->radius_meters + $tolerance);
    }

    /**
     * Great-circle distance between two points in meters (Haversine formula).
     */
    public function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return self::EARTH_RADIUS_METERS * $c;
    }
}
