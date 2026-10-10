<?php

namespace App\Support;

/** A short, readable device name from a browser user agent ("Chrome on Windows"). */
class DeviceName
{
    /** @return array{label: string, kind: 'phone'|'tablet'|'desktop'|'unknown'} */
    public static function from(?string $userAgent): array
    {
        $ua = (string) $userAgent;
        if ($ua === '') {
            return ['label' => 'Unknown device', 'kind' => 'unknown'];
        }

        $browser = match (true) {
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'OPR/') || str_contains($ua, 'Opera') => 'Opera',
            str_contains($ua, 'SamsungBrowser') => 'Samsung Internet',
            str_contains($ua, 'Firefox/') || str_contains($ua, 'FxiOS') => 'Firefox',
            str_contains($ua, 'Chrome/') || str_contains($ua, 'CriOS') => 'Chrome',
            str_contains($ua, 'Safari/') => 'Safari',
            default => null,
        };

        [$os, $kind] = match (true) {
            str_contains($ua, 'iPad') => ['iPad', 'tablet'],
            str_contains($ua, 'iPhone') => ['iPhone', 'phone'],
            str_contains($ua, 'Android') => ['Android', str_contains($ua, 'Mobile') ? 'phone' : 'tablet'],
            str_contains($ua, 'Windows') => ['Windows', 'desktop'],
            str_contains($ua, 'Mac OS X') || str_contains($ua, 'Macintosh') => ['Mac', 'desktop'],
            str_contains($ua, 'CrOS') => ['Chromebook', 'desktop'],
            str_contains($ua, 'Linux') => ['Linux', 'desktop'],
            default => [null, 'unknown'],
        };

        $label = match (true) {
            $browser && $os => "{$browser} on {$os}",
            (bool) $browser => $browser,
            (bool) $os => $os,
            default => 'Unknown device',
        };

        return ['label' => $label, 'kind' => $kind];
    }
}
