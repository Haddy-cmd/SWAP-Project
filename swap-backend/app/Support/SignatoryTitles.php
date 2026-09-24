<?php

namespace App\Support;

use App\Models\StipendSignature;
use App\Models\User;

/**
 * The single definition of who signs a stub AS WHAT. Supervisor and
 * beneficiary titles are fixed policy (no manual entry); the director's title
 * is the releasing admin's profile-entered position_title (release is blocked
 * without it). The blade reads this — never hardcode titles in views.
 */
class SignatoryTitles
{
    public const SUPERVISOR = 'SWAP Mentor';
    public const BENEFICIARY = 'SWAP BENEFICIARY';

    public static function for(string $signatoryRole, ?User $user = null): ?string
    {
        return match ($signatoryRole) {
            StipendSignature::ROLE_SUPERVISOR => self::SUPERVISOR,
            StipendSignature::ROLE_BENEFICIARY => self::BENEFICIARY,
            StipendSignature::ROLE_DIRECTOR => $user?->position_title,
            default => null,
        };
    }
}
