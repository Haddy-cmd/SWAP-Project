<?php

namespace App\Support;

use App\Models\Setting;
use App\Models\User;

/**
 * Admin → System Testing. Switched on and off from its own page (setting
 * `test_tools_enabled`, off by default). Its shortcuts and rule bypasses only ever apply
 * to existing accounts the admin picked (`users.testing_added_at`) — everyone else always
 * gets the real rules.
 */
class TestTools
{
    public const SETTING = 'test_tools_enabled';

    public const MSG_OFF = 'Switch System Testing on first.';

    /** Memo for the current request/job (list resources ask once per row). */
    private static ?bool $enabled = null;

    public static function enabled(): bool
    {
        return self::$enabled ??= Setting::bool(self::SETTING, false);
    }

    public static function setEnabled(bool $on): void
    {
        Setting::put(self::SETTING, $on ? '1' : '0');
        self::$enabled = $on;
    }

    /** Drop the memo (end of each request and before each queued job). */
    public static function flush(): void
    {
        self::$enabled = null;
    }

    /** An account the admin picked for System Testing. */
    public static function inTesting(?User $user): bool
    {
        return $user !== null && $user->testing_added_at !== null;
    }

    /** Whether the testing rule bypasses apply to this user (picked, tools on). */
    public static function bypasses(?User $user): bool
    {
        // Account check first so everyone else never costs a settings query.
        return self::inTesting($user) && self::enabled();
    }
}
