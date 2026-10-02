<?php

namespace App\Support;

use Illuminate\Validation\Rules\Password;

/**
 * The rule for every new password (registration, reset, staff invitation, profile change),
 * with the same messages the frontend shows on its live checklist (lib/utils/password.ts).
 */
class PasswordPolicy
{
    public const MSG_MIN = 'Password must be at least 8 characters.';
    public const MSG_MIXED = 'Password must have at least one uppercase and one lowercase letter.';
    public const MSG_NUMBERS = 'Password must have at least one number.';

    public static function rule(): Password
    {
        return Password::min(8)->mixedCase()->numbers();
    }

    /** Custom messages for the password field (keys as the Password rule reports them). */
    public static function messages(string $field = 'password'): array
    {
        return [
            "{$field}.min" => self::MSG_MIN,
            "{$field}.password.mixed" => self::MSG_MIXED,
            "{$field}.password.numbers" => self::MSG_NUMBERS,
        ];
    }
}
