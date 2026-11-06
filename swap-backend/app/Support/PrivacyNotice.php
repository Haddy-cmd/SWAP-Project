<?php

namespace App\Support;

/**
 * Consent to the Privacy Notice (the frontend's /privacy page) when an account is created:
 * on student registration and on accepting a staff invitation. Bump VERSION when the notice
 * changes so it's clear which text someone agreed to.
 */
class PrivacyNotice
{
    public const VERSION = '2026-11';

    public const MSG_REQUIRED = 'Please read and agree to the Privacy Notice.';

    public static function rules(): array
    {
        return ['privacy_consent' => ['accepted']];
    }

    public static function messages(): array
    {
        return [
            'privacy_consent.required' => self::MSG_REQUIRED,
            'privacy_consent.accepted' => self::MSG_REQUIRED,
        ];
    }

    /** The columns to save on the new account (set with forceFill: not mass-assignable). */
    public static function stamp(): array
    {
        return ['privacy_accepted_at' => now(), 'privacy_version' => self::VERSION];
    }
}
