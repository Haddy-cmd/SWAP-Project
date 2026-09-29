<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

/**
 * The Banking Office's releasing officer and their PIN, set together by a DSA
 * admin (Admin → Stipend). The officer enters only the PIN on the scan-to-
 * release page; the admin-set name is what goes on the stub, so it can't be
 * mistyped or filled in by the browser. Only the PIN's hash is stored.
 */
class BankingOfficePin
{
    private const SETTING = 'ubo_release_pin_hash';
    private const OFFICER = 'ubo_release_officer_name';

    public const MSG_NOT_SET = 'The Banking Office PIN has not been set up yet. Please contact the DSA Office.';
    public const MSG_WRONG = 'The Banking Office PIN is incorrect.';

    /** Ready for payouts: both a PIN and the officer's name are set. */
    public static function isSet(): bool
    {
        return self::hasPin() && self::officerName() !== null;
    }

    public static function hasPin(): bool
    {
        return (bool) Setting::get(self::SETTING);
    }

    public static function officerName(): ?string
    {
        $name = trim((string) Setting::get(self::OFFICER, ''));

        return $name === '' ? null : $name;
    }

    /** Save the officer's name, and the PIN when a new one is given. */
    public static function set(?string $pin, string $officerName): void
    {
        if ($pin !== null && $pin !== '') {
            Setting::put(self::SETTING, Hash::make($pin));
        }
        Setting::put(self::OFFICER, trim($officerName));
    }

    public static function matches(string $pin): bool
    {
        $hash = Setting::get(self::SETTING);

        return $hash && Hash::check($pin, $hash);
    }

    /** When the PIN was last changed (ISO), for the admin card. */
    public static function updatedAt(): ?string
    {
        $at = Setting::where('key', self::SETTING)->value('updated_at');

        return $at ? Carbon::parse($at)->toISOString() : null;
    }
}
