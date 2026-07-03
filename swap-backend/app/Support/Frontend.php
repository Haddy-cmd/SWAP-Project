<?php

namespace App\Support;

class Frontend
{
    /**
     * Absolute URL on the deployed frontend (FRONTEND_URL). Normalizes empty or
     * scheme-less values so links embedded in emails are never relative —
     * click-trackers (Brevo) reject those with "host missing" and 404.
     */
    public static function url(string $path = '/'): string
    {
        $base = trim((string) config('swap.frontend_url'));

        if ($base === '') {
            $base = 'http://localhost:3000';
        }

        if (!str_contains($base, '://')) {
            $base = 'https://' . $base;
        }

        return rtrim($base, '/') . '/' . ltrim($path, '/');
    }
}
