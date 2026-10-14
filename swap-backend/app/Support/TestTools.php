<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;

/**
 * Admin → System Testing. Switched on and off only by the environment — SWAP_TEST_TOOLS
 * (config swap.test_tools), on the live server and locally alike; there is no switch in the app.
 * Off: the page and its API are gone and nothing is bypassed; the next boot's
 * `testing:shutdown` restores the accounts still in testing. On: its shortcuts and rule bypasses
 * only ever apply to existing accounts the admin picked (`users.testing_added_at`) — everyone
 * else always gets the real rules.
 *
 * Each picked account has its own email switch (`users.testing_email_muted`, off = muted by
 * default when picked): a muted account still gets every bell notification, and account emails
 * (verification, password reset) always go out.
 */
class TestTools
{
    public const MSG_UNAVAILABLE = 'System Testing is turned off on this server.';

    /** Account emails a picked student may still need while testing. */
    private const ALWAYS_EMAILED = [ResetPassword::class, VerifyEmail::class, \App\Notifications\OneTimeCodeNotification::class];

    /** Whether System Testing is on (SWAP_TEST_TOOLS). */
    public static function enabled(): bool
    {
        return (bool) config('swap.test_tools');
    }

    /** Same as enabled(): this server offers System Testing. */
    public static function available(): bool
    {
        return self::enabled();
    }

    /**
     * Whether an email to this notifiable is skipped: a picked account whose email switch is
     * off, except the account emails in ALWAYS_EMAILED.
     */
    public static function mutesEmail(mixed $notifiable, ?object $notification = null): bool
    {
        if (!$notifiable instanceof User || !self::inTesting($notifiable)) {
            return false;
        }
        foreach (self::ALWAYS_EMAILED as $class) {
            if ($notification instanceof $class) {
                return false;
            }
        }

        return (bool) $notifiable->testing_email_muted;
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
