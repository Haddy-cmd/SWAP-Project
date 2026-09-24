<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Page-level step-up for Stipend Management: the admin re-enters their password
 * once (popup gate) and gets a short-lived opaque token that authorizes
 * release/void calls without re-typing the password every time.
 *
 * Only a sha256 hash is cached — the plaintext token lives client-side in
 * component memory and is never persisted. TTL slides on each successful use.
 */
class StipendUnlock
{
    /** Seconds an unlock stays valid without activity. */
    public const TTL_SECONDS = 900;

    public static function issue(User $admin): string
    {
        $token = Str::random(64);
        Cache::put(self::key($admin->id, $token), true, self::TTL_SECONDS);

        // Index the hash so every outstanding token can be revoked at once.
        $indexKey = self::indexKey($admin->id);
        $index = Cache::get($indexKey, []);
        $index[] = hash('sha256', $token);
        Cache::put($indexKey, array_values(array_unique($index)), self::TTL_SECONDS);

        return $token;
    }

    public static function verify(User $admin, ?string $token): bool
    {
        if (!is_string($token) || $token === '') {
            return false;
        }

        $key = self::key($admin->id, $token);
        if (!Cache::has($key)) {
            return false;
        }

        // Sliding expiry: activity keeps the gate open.
        Cache::put($key, true, self::TTL_SECONDS);

        return true;
    }

    public static function revoke(User $admin): void
    {
        $indexKey = self::indexKey($admin->id);
        foreach (Cache::get($indexKey, []) as $hash) {
            Cache::forget(self::keyForHash($admin->id, $hash));
        }
        Cache::forget($indexKey);
    }

    /** Step-up rule: verify a password against the bound (Sanctum-stateless) user. */
    public static function passwordRule(User $user): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($user): void {
            if (!Hash::check((string) $value, (string) $user->password)) {
                $fail('The password you entered is incorrect.');
            }
        };
    }

    /** Page-gate rule: accept the token issued by POST /admin/stipend/unlock. */
    public static function tokenRule(User $user): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail) use ($user): void {
            if (!self::verify($user, is_string($value) ? $value : null)) {
                $fail('The stipend gate has expired. Re-enter your password to unlock it again.');
            }
        };
    }

    private static function key(int $adminId, string $token): string
    {
        return self::keyForHash($adminId, hash('sha256', $token));
    }

    private static function keyForHash(int $adminId, string $hash): string
    {
        return 'stipend-unlock:'.$adminId.':'.$hash;
    }

    private static function indexKey(int $adminId): string
    {
        return 'stipend-unlock-index:'.$adminId;
    }
}
