<?php

namespace App\Services;

use App\Models\Office;

class GeofenceService
{
    private const EARTH_RADIUS_METERS = 6_371_000;

    /**
     * Whether the given coordinates fall within the office's geofence.
     * Offices without geofencing enabled (or missing coordinates) always pass.
     */
    public function isWithin(Office $office, float $latitude, float $longitude): bool
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

        return $distance <= (float) $office->radius_meters;
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
